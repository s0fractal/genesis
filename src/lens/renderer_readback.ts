import { OmegaV2Engine } from '../environment/v2_bridge.ts';
import { RendererBuffers } from './renderer_buffers.ts';

export class RendererReadback {
    private device: GPUDevice;
    private engine: OmegaV2Engine;

    private lastReadbackTime: number = 0;
    private readonly READBACK_INTERVAL_MS: number = 100;
    private cachedSnapshot: Uint8Array | null = null;
    private cachedGoldenTrace: string = "";
    private cachedGoldenTraceNum: number = 0;

    constructor(device: GPUDevice, engine: OmegaV2Engine) {
        this.device = device;
        this.engine = engine;
    }

    public async readStateFromGPUAndHash(buffers: RendererBuffers): Promise<{ goldenTrace: string, goldenTraceNum: number, snapshot: Uint8Array }> {
        const now = performance.now();
        if (now - this.lastReadbackTime < this.READBACK_INTERVAL_MS && this.cachedSnapshot) {
            return {
                goldenTrace: this.cachedGoldenTrace,
                goldenTraceNum: this.cachedGoldenTraceNum,
                snapshot: this.cachedSnapshot,
            };
        }
        this.lastReadbackTime = now;

        const commandEncoder = this.device.createCommandEncoder();
        const currentStateBuffer = buffers.agentsPingPong === 0 ? buffers.agentsBufferA : buffers.agentsBufferB;
        commandEncoder.copyBufferToBuffer(
            currentStateBuffer, 0,
            buffers.stagingAgentsBuffer, 0,
            buffers.stagingAgentsBuffer.size
        );
        this.device.queue.submit([commandEncoder.finish()]);
        
        await buffers.stagingAgentsBuffer.mapAsync(GPUMapMode.READ);
        const copyArray = new Uint8Array(buffers.stagingAgentsBuffer.getMappedRange());
        
        const snapshot = new Uint8Array(copyArray);
        
        const ptrs = this.engine.getMemoryPointers();
        ptrs.agentBytes.set(snapshot); 
        
        const mitosis = this.engine.wasm?.exports.v2_mitosis_sweep as CallableFunction;
        const numReplications = mitosis ? mitosis() as number : 0;
        
        if (numReplications > 0) {
             this.overwriteGPUState(ptrs.agentBytes, buffers);
             snapshot.set(ptrs.agentBytes); 
        }
        
        buffers.stagingAgentsBuffer.unmap();
        
        const traceNum = (this.engine.wasm?.exports.v2_get_golden_trace as CallableFunction)() as number;
        this.cachedSnapshot = snapshot;
        this.cachedGoldenTrace = traceNum.toString(16).toUpperCase();
        this.cachedGoldenTraceNum = traceNum;
        return {
            goldenTrace: this.cachedGoldenTrace,
            goldenTraceNum: this.cachedGoldenTraceNum,
            snapshot
        };
    }

    public overwriteGPUState(snapshot: Uint8Array, buffers: RendererBuffers) {
        this.device.queue.writeBuffer(buffers.agentsBufferA, 0, snapshot.buffer as ArrayBuffer, snapshot.byteOffset, snapshot.byteLength);
        this.device.queue.writeBuffer(buffers.agentsBufferB, 0, snapshot.buffer as ArrayBuffer, snapshot.byteOffset, snapshot.byteLength);
    }
}
