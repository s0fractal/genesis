import { OmegaV2Engine } from "../environment/v2_bridge.ts";
import { RendererBuffers } from "./renderer_buffers.ts";

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

  public async readStateFromGPUAndHash(
    buffers: RendererBuffers,
  ): Promise<
    {
      goldenTrace: string;
      goldenTraceNum: number;
      snapshot: Uint8Array;
      /** Children written into the array during this readback. The live
       *  verifier skips any interval this is non-zero for: mitosis perturbs the
       *  state between readbacks, so the GPU did not simply run K steps from
       *  where it was, and a differential over that interval would report a
       *  drift the CPU caused itself. */
      replications: number;
    }
  > {
    const now = performance.now();
    if (
      now - this.lastReadbackTime < this.READBACK_INTERVAL_MS &&
      this.cachedSnapshot
    ) {
      return {
        goldenTrace: this.cachedGoldenTrace,
        goldenTraceNum: this.cachedGoldenTraceNum,
        snapshot: this.cachedSnapshot,
        replications: 0, // cached hit: no sweep ran
      };
    }
    this.lastReadbackTime = now;

    const commandEncoder = this.device.createCommandEncoder();
    const currentStateBuffer = buffers.agentsPingPong === 0
      ? buffers.agentsBufferA
      : buffers.agentsBufferB;
    commandEncoder.copyBufferToBuffer(
      currentStateBuffer,
      0,
      buffers.stagingAgentsBuffer,
      0,
      buffers.stagingAgentsBuffer.size,
    );
    this.device.queue.submit([commandEncoder.finish()]);

    await buffers.stagingAgentsBuffer.mapAsync(GPUMapMode.READ);
    const copyArray = new Uint8Array(
      buffers.stagingAgentsBuffer.getMappedRange(),
    );

    const snapshot = new Uint8Array(copyArray);

    const ptrs = this.engine.getMemoryPointers();
    ptrs.agentBytes.set(snapshot);

    // Death is booked here, before birth, for the same reason birth is booked
    // here at all: the compute shader owns the per-agent step but cannot write
    // `signals` (it is bound `var<uniform>`). So the shader flips the dead bit
    // and nothing else — no entropy burst, no compost message, no aggregates —
    // and `total_entropy_released` sat at zero for the entire lifetime of the
    // GPU path while reading like a working thermodynamic ledger. The kernel's
    // own inline guard cannot recover those deaths: it books on
    // `energy == 0 && !dead`, and the shader has already set that bit.
    // See PhaseLattice::reap_off_cpu_deaths.
    const reap = this.engine.wasm?.exports.v2_reap_deaths as CallableFunction;
    if (reap) reap();

    const mitosis = this.engine.wasm?.exports
      .v2_mitosis_sweep as CallableFunction;
    const numReplications = mitosis ? mitosis() as number : 0;

    if (numReplications > 0) {
      this.overwriteGPUState(ptrs.agentBytes, buffers);
      snapshot.set(ptrs.agentBytes);
    }

    buffers.stagingAgentsBuffer.unmap();

    const traceNum = (this.engine.wasm?.exports
      .v2_get_golden_trace as CallableFunction)() as number;
    this.cachedSnapshot = snapshot;
    this.cachedGoldenTrace = traceNum.toString(16).toUpperCase();
    this.cachedGoldenTraceNum = traceNum;
    return {
      goldenTrace: this.cachedGoldenTrace,
      goldenTraceNum: this.cachedGoldenTraceNum,
      snapshot,
      replications: numReplications,
    };
  }

  public overwriteGPUState(snapshot: Uint8Array, buffers: RendererBuffers) {
    this.device.queue.writeBuffer(
      buffers.agentsBufferA,
      0,
      snapshot.buffer as ArrayBuffer,
      snapshot.byteOffset,
      snapshot.byteLength,
    );
    this.device.queue.writeBuffer(
      buffers.agentsBufferB,
      0,
      snapshot.buffer as ArrayBuffer,
      snapshot.byteOffset,
      snapshot.byteLength,
    );
  }
}
