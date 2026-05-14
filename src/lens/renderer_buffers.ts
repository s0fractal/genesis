import { OmegaV2Engine } from '../environment/v2_bridge.ts';

export class RendererBuffers {
    private device: GPUDevice;
    private engine: OmegaV2Engine;

    public topologyBuffer!: GPUBuffer;
    public signalsBuffer!: GPUBuffer;
    public intentBuffer!: GPUBuffer;
    public agentsBufferA!: GPUBuffer;
    public agentsBufferB!: GPUBuffer;
    public stagingAgentsBuffer!: GPUBuffer;
    public sineLutBuffer!: GPUBuffer;
    public newMeanFieldBuffer!: GPUBuffer;
    public oldMeanFieldBuffer!: GPUBuffer;
    public attractorBuffer!: GPUBuffer;

    public agentsPingPong: number = 0; // 0 = A is source, B is target; 1 = vice versa

    constructor(device: GPUDevice, engine: OmegaV2Engine) {
        this.device = device;
        this.engine = engine;
    }

    public initialize() {
        const pointers = this.engine.getMemoryPointers();

        this.topologyBuffer = this.device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.signalsBuffer = this.device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.intentBuffer = this.device.createBuffer({
            size: 128, // 4 intents * 32 bytes each
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.agentsBufferA = this.device.createBuffer({
            size: pointers.agentBytes.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        this.agentsBufferB = this.device.createBuffer({
            size: pointers.agentBytes.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        this.stagingAgentsBuffer = this.device.createBuffer({
            size: pointers.agentBytes.byteLength,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        // Initialize GPU with the Genesis State once (write to both so first ping-pong is valid)
        this.device.queue.writeBuffer(this.agentsBufferA, 0, pointers.agentBytes);
        this.device.queue.writeBuffer(this.agentsBufferB, 0, pointers.agentBytes);

        // 256 elements * 4 bytes (i32) = 1024 bytes
        this.sineLutBuffer = this.device.createBuffer({
            size: 1024,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        // Default to Q10 LUT for toroidal shader
        this.device.queue.writeBuffer(this.sineLutBuffer, 0, pointers.sineLutQ10Bytes);

        // Ping-Pong Global Order Accumulator (8 bytes)
        this.newMeanFieldBuffer = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        this.oldMeanFieldBuffer = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        this.device.queue.writeBuffer(this.oldMeanFieldBuffer, 0, new Uint8Array(8));

        // Attractor Array Uniform Buffer (80 bytes)
        this.attractorBuffer = this.device.createBuffer({
            size: 80,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.attractorBuffer, 0, new Uint8Array(80));
    }

    public writeUniforms(ptrs: ReturnType<OmegaV2Engine["getMemoryPointers"]>) {
        this.device.queue.writeBuffer(this.topologyBuffer, 0, ptrs.uniformBytes, 0, 32);
        this.device.queue.writeBuffer(this.signalsBuffer, 0, ptrs.uniformBytes, 32, 32);
        this.device.queue.writeBuffer(this.attractorBuffer, 0, ptrs.attractorBytes, 0, 80);
        this.device.queue.writeBuffer(this.intentBuffer, 0, ptrs.uniformBytes, 64, 128);
    }
}
