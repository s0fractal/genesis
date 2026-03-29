import computeV2Src from './shaders/compute_v2.wgsl?raw';
import renderV2Src from './shaders/render_v2.wgsl?raw';
import { OmegaV2Engine } from '../environment/v2_bridge.ts';

export class PhaseV2Renderer {
    private device: GPUDevice;
    private engine: OmegaV2Engine;
    private context: GPUCanvasContext;
    private format: GPUTextureFormat;

    private computePipeline!: GPUComputePipeline;
    private renderPipeline!: GPURenderPipeline;
    private computeBindGroup!: GPUBindGroup;
    private renderBindGroup!: GPUBindGroup;

    private topologyBuffer!: GPUBuffer;
    private signalsBuffer!: GPUBuffer;
    private intentBuffer!: GPUBuffer;
    private agentsBuffer!: GPUBuffer;
    private stagingAgentsBuffer!: GPUBuffer;
    private sineLutBuffer!: GPUBuffer;
    
    // Era 4000: Global Order Parameter Feedback Loop
    private newMeanFieldBuffer!: GPUBuffer;
    private oldMeanFieldBuffer!: GPUBuffer;
    private _mouseBound: boolean = false;
    private activeDNSPhase: number = 0; // Era 8000: Target Routing
    private activeOpcode: number = 0;   // Era 8000: Default Safe

    // Era 9000: The Autopoiesis Daemon State
    public daemonState: string = "OBSERVING";
    private lastDaemonTick: number = 0;
    
    // ERA 7000: Semantic Logos state
    private activeGodWord: string = "GENESIS";
    private activeGodHash: number = 0;
    
    private djb2Hash(str: string): number {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
        }
        return hash >>> 0;
    }

    constructor(context: GPUCanvasContext, device: GPUDevice, format: GPUTextureFormat, engine: OmegaV2Engine) {
        this.context = context;
        this.format = format;
        this.device = device;
        this.engine = engine;
    }

    public async initialize() {
        console.log("🌌 [V2-WEBGPU] Initializing Zero-Copy Pipelines...");

        const pointers = this.engine.getMemoryPointers();

        this.topologyBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.signalsBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.intentBuffer = this.device.createBuffer({
            size: 128, // 4 intents * 32 bytes each
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.agentsBuffer = this.device.createBuffer({
            size: pointers.agentBytes.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        this.stagingAgentsBuffer = this.device.createBuffer({
            size: pointers.agentBytes.byteLength,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        // Initialize GPU with the Genesis State once
        this.device.queue.writeBuffer(this.agentsBuffer, 0, pointers.agentBytes);

        // 128 elements * 4 bytes (i32) = 512 bytes tightly packed Read-Only Storage Array
        this.sineLutBuffer = this.device.createBuffer({
            size: 512,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        
        // Era 4000: Ping-Pong Global Order Accumulator (8 bytes: i32 Cos, i32 Sin)
        this.newMeanFieldBuffer = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        
        this.oldMeanFieldBuffer = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        const computeModule = this.device.createShaderModule({ code: computeV2Src });
        const renderModule = this.device.createShaderModule({ code: renderV2Src });
        
        this.computePipeline = await this.device.createComputePipelineAsync({
            layout: 'auto',
            compute: {
                module: computeModule,
                entryPoint: 'compute_main',
            },
        });

        this.renderPipeline = await this.device.createRenderPipelineAsync({
            layout: 'auto',
            vertex: {
                module: renderModule,
                entryPoint: 'vs_main',
            },
            fragment: {
                module: renderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: this.format,
                    blend: {
                        color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
                    }
                }],
            },
            primitive: {
                topology: 'triangle-list',
            }
        });

        // Ensure Daemon starts quietly
        this.lastDaemonTick = performance.now();

        const computeBindEntries = [
            { binding: 0, resource: { buffer: this.topologyBuffer } },
            { binding: 1, resource: { buffer: this.signalsBuffer } },
            { binding: 2, resource: { buffer: this.agentsBuffer } },
            { binding: 3, resource: { buffer: this.sineLutBuffer } },
            { binding: 4, resource: { buffer: this.intentBuffer } },
            { binding: 5, resource: { buffer: this.newMeanFieldBuffer } },
            { binding: 6, resource: { buffer: this.oldMeanFieldBuffer } },
        ];

        this.computeBindGroup = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(0),
            entries: computeBindEntries,
        });

        const renderBindEntries = [
            { binding: 0, resource: { buffer: this.topologyBuffer } },
            { binding: 1, resource: { buffer: this.signalsBuffer } },
            { binding: 2, resource: { buffer: this.agentsBuffer } },
        ];

        this.renderBindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: renderBindEntries,
        });

        console.log("✅ [V2-WEBGPU] Pipeline Assembled.");
    }

    public tick() {
        this.engine.tick();
        const ptrs = this.engine.getMemoryPointers();

        this.device.queue.writeBuffer(this.topologyBuffer, 0, ptrs.uniformBytes, 0, 16);
        this.device.queue.writeBuffer(this.signalsBuffer, 0, ptrs.uniformBytes, 16, 16);
        this.device.queue.writeBuffer(this.intentBuffer, 0, ptrs.uniformBytes, 32, 128);
        
        // Removed: this.device.queue.writeBuffer(this.agentsBuffer, 0, ptrs.agentBytes);
        // We do NOT overwrite the GPU state every frame anymore. WebGPU owns the matrix math.


        // Upload LUT (Only once per frame is redundant since it's static, but ensures zero-cost pointer persistence)
        this.device.queue.writeBuffer(this.sineLutBuffer, 0, ptrs.sineLutBytes);

        const commandEncoder = this.device.createCommandEncoder();
        
        // ERA 4000: Clear the atomic aggregation buffer for this frame's Mean Field reduction
        commandEncoder.clearBuffer(this.newMeanFieldBuffer);
        
        // 1. Compute Pass
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.computePipeline);
        passEncoder.setBindGroup(0, this.computeBindGroup);
        
        const activeCount = new Uint32Array(ptrs.uniformBytes.buffer, ptrs.uniformBytes.byteOffset + 16 + 8, 1)[0];
        const dispatchSize = Math.ceil(activeCount / 64);
        if (dispatchSize > 0) { passEncoder.dispatchWorkgroups(dispatchSize); }
        passEncoder.end();
        
        // ERA 4000: Map the newly reduced Global Vector into the historical reader buffer for the subsequent frame
        if (dispatchSize > 0) {
            commandEncoder.copyBufferToBuffer(this.newMeanFieldBuffer, 0, this.oldMeanFieldBuffer, 0, 8);
        }
        
        // 2. Render Pass
        const renderPassEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0.02, g: 0.02, b: 0.02, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }]
        });
        
        // --- 1010 Event Mapping ---
        if (!this._mouseBound) {
            this._mouseBound = true;
            
            // ERA 7000: Semantic Input Listener
            const semanticInput = document.getElementById("semantic-input") as HTMLInputElement;
            if (semanticInput) {
                const updateGodWord = () => {
                    const inputStr = semanticInput.value.trim().toUpperCase() || "GENESIS";
                    this.activeGodWord = inputStr;
                    this.activeGodHash = this.djb2Hash(inputStr);
                };
                semanticInput.addEventListener('keyup', updateGodWord);
                semanticInput.addEventListener('change', updateGodWord);
                updateGodWord();
            }
            
            globalThis.addEventListener('keydown', (e: Event) => {
                const navMap: Record<string, number> = {
                    '1': 0,    // Aries
                    '2': 64,   // Cancer
                    '3': 128,  // Libra
                    '4': 192   // Capricorn
                };
                const opMap: Record<string, number> = {
                    'q': 1, // Opcode 1: Lysogenic Mutagenesis
                    'w': 2, // Opcode 2: Somatic Mitosis Burst
                    'e': 3, // Opcode 3: Neural Paralysis
                    'r': 0  // Opcode 0: Safe data routing
                };
                
                const key = (e as KeyboardEvent).key.toLowerCase();
                const HUD_ELEM = document.getElementById("hud-stat-c-val");
                
                if (navMap[key] !== undefined) {
                    this.activeDNSPhase = navMap[key];
                    const names = {0: "ARIES", 64: "CANCER", 128: "LIBRA", 192: "CAPRICORN"};
                    if (HUD_ELEM) HUD_ELEM.innerText = `ROUTING: ${names[this.activeDNSPhase as keyof typeof names]}`;
                }
                
                if (opMap[key] !== undefined) {
                    this.activeOpcode = opMap[key];
                    const vNames = {0: "BENIGN_DATA", 1: "LYSOGENIC_VIRUS", 2: "SOMATIC_BURST", 3: "NEURAL_PARALYSIS"};
                    if (HUD_ELEM) HUD_ELEM.innerText = `[VIRUS ARMED]: ${vNames[this.activeOpcode as keyof typeof vNames]}`;
                }
            });

            globalThis.addEventListener('mousemove', (e: Event) => {
                const mouseEvent = e as MouseEvent;
                // Only inject if mouse is held down (drags)
                if (mouseEvent.buttons !== 1) return;
                
                if (!(this.context.canvas instanceof HTMLCanvasElement)) return;
                const rect = this.context.canvas.getBoundingClientRect();
                const x = ((mouseEvent.clientX - rect.left) / rect.width) * 2.0 - 1.0;
                const y = -(((mouseEvent.clientY - rect.top) / rect.height) * 2.0 - 1.0);
                
                const ix = Math.floor(x * 1000);
                const iy = Math.floor(y * 1000);
                
                const isGodMode = mouseEvent.shiftKey;
                const opMode = isGodMode ? 1 : 0;
                
                let packedMass = 0;
                let semanticGenome = 0;
                
                // ERA 7000 vs ERA 1000 Branching
                if (isGodMode) {
                    packedMass = 3000; // Pure Gravity
                    semanticGenome = this.activeGodHash;
                    // Flash HUD safely
                    const HUD_ELEM = document.getElementById("hud-stat-c-val");
                    if (HUD_ELEM) HUD_ELEM.innerText = `[LOGOS INJECTION]: ${this.activeGodWord}`;
                } else {
                    const payload = this.activeOpcode; // ERA 8000: Embed the Viral Opcode
                    const baseMass = 2000; 
                    packedMass = (payload << 24) | (this.activeDNSPhase << 16) | baseMass;
                    semanticGenome = 0;
                }
                
                // Update Mesh broadcasting intent
                if ((globalThis as unknown as { _v2Mesh: any })._v2Mesh) {
                    (globalThis as unknown as { _v2Mesh: any })._v2Mesh.__lastLocalIntent = { x: ix, y: iy, m: packedMass, r: 200, g: semanticGenome, op: opMode };
                }
                
                // Target Intent Slot 0 for local mouse
                const setIntent = this.engine.wasm?.exports.v2_set_intent as CallableFunction;
                if (setIntent) setIntent(0, ix, iy, packedMass, 200, semanticGenome, opMode);
            });
            globalThis.addEventListener('mouseout', () => {
                if ((globalThis as unknown as { _v2Mesh: any })._v2Mesh) {
                    (globalThis as unknown as { _v2Mesh: any })._v2Mesh.__lastLocalIntent = { x: 0, y: 0, m: 0, r: 0, g: 0, op: 0 };
                }
                const setIntent = this.engine.wasm?.exports.v2_set_intent as CallableFunction;
                if (setIntent) setIntent(0, 0, 0, 0, 0, 0, 0);
            });
            globalThis.addEventListener('mouseup', () => {
                const setIntent = this.engine.wasm?.exports.v2_set_intent as CallableFunction;
                if (setIntent) setIntent(0, 0, 0, 0, 0, 0, 0);
            });
        }
        
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(0, this.renderBindGroup);
        if (activeCount > 0) { renderPassEncoder.draw(6, activeCount, 0, 0); }
        renderPassEncoder.end();
        
        // --- ERA 9000: THE AUTOPOIESIS DAEMON ---
        // Algorithmic Ecosystem Watchdog (Runs dynamically post-render phase)
        const now = performance.now();
        if (now - this.lastDaemonTick > 2000) { // Evaluate every 2 seconds
            this.lastDaemonTick = now;
            const setIntent = this.engine.wasm?.exports.v2_set_intent as CallableFunction | undefined;
            
            if (setIntent) {
                // Rule of Genesis: Prevent Extinction
                if (activeCount < 100000) {
                    this.daemonState = "INTERVENING (GENESIS)";
                    const gx = Math.floor(Math.random() * window.innerWidth);
                    const gy = Math.floor(Math.random() * window.innerHeight);
                    // Force shift+click like behavior (God Mode | OpMode 1)
                    let hash = 5381;
                    const word = "AUTOPOIESIS";
                    for (let i = 0; i < word.length; i++) hash = ((hash << 5) + hash) + word.charCodeAt(i);
                    // Broadcast autonomous intent via Slot 1 (Daemon Dedicated Slot)
                    setIntent(1, gx, gy, 0, 400, hash >>> 0, 1);
                    
                    // Clear the intent after 500ms
                    setTimeout(() => { if (this.engine.wasm) setIntent(1, 0, 0, 0, 0, 0, 0); }, 500);
                } 
                // Rule of Decay: Overpopulation Check
                else if (activeCount > 900000) {
                    this.daemonState = "INTERVENING (CULLING)";
                    // Inject Neural Paralysis
                    const gx = Math.floor(Math.random() * window.innerWidth);
                    const gy = Math.floor(Math.random() * window.innerHeight);
                    // Opcode 3 Neural Freeze, Mass = 2000
                    const packedMass = (3 << 24) | (0 << 16) | 2000;
                    setIntent(1, gx, gy, packedMass, 300, 0, 0); // No OpMode, normal routing
                    
                    setTimeout(() => { if (this.engine.wasm) setIntent(1, 0, 0, 0, 0, 0, 0); }, 1000);
                }
                else {
                    this.daemonState = "OBSERVING";
                    setIntent(1, 0, 0, 0, 0, 0, 0);
                }
            }
        }
        
        this.device.queue.submit([commandEncoder.finish()]);
    }

    /** 
     * Era 2020: WebRTC Snapshot Extraction
     * Maps the GPU agents buffer into JS memory, then copies it into the Zero-Copy WASM pointer
     * Finally computes the deterministic Golden Trace checksum.
     */
    public async readStateFromGPUAndHash(): Promise<{ goldenTrace: string, snapshot: Uint8Array }> {
        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(
            this.agentsBuffer, 0,
            this.stagingAgentsBuffer, 0,
            this.stagingAgentsBuffer.size
        );
        this.device.queue.submit([commandEncoder.finish()]);
        
        await this.stagingAgentsBuffer.mapAsync(GPUMapMode.READ);
        const copyArray = new Uint8Array(this.stagingAgentsBuffer.getMappedRange());
        
        // Make a clone of the snapshot to return to WebRTC
        const snapshot = new Uint8Array(copyArray);
        
        const ptrs = this.engine.getMemoryPointers();
        ptrs.agentBytes.set(snapshot); // Flush the memory back into the bare-metal Rust `.bss`
        
        // Era 3000: Execute the single-threaded CPU Darwinian Mitosis Sweep
        const mitosis = this.engine.wasm?.exports.v2_mitosis_sweep as CallableFunction;
        const numReplications = mitosis ? mitosis() as number : 0;
        
        // If the CPU mutated the matrix (cells died or split), we must re-upload the modified .bss to the GPU instantly
        if (numReplications > 0) {
             this.overwriteGPUState(ptrs.agentBytes);
             snapshot.set(ptrs.agentBytes); // Update the WebRTC snapshot reference to the post-mitosis state
        }
        
        this.stagingAgentsBuffer.unmap();
        
        // Execute the fast cryptographic O(N/1024) matrix hashing in WASM
        const traceNum = (this.engine.wasm?.exports.v2_get_golden_trace as CallableFunction)();
        return {
            goldenTrace: traceNum.toString(16).toUpperCase(),
            snapshot
        };
    }

    /** Overwrites the entire local GPU state with a WebRTC rollback snapshot */
    public overwriteGPUState(snapshot: Uint8Array) {
        this.device.queue.writeBuffer(this.agentsBuffer, 0, snapshot.buffer as ArrayBuffer, snapshot.byteOffset, snapshot.byteLength);
    }
}
