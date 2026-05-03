import computeV2Src from './shaders/compute_v2.wgsl?raw';
import computeToroidalSrc from './shaders/compute_toroidal.wgsl?raw';
import renderV2Src from './shaders/render_v2.wgsl?raw';
import { OmegaV2Engine } from '../environment/v2_bridge.ts';

export class PhaseV2Renderer {
    private device: GPUDevice;
    private engine: OmegaV2Engine;
    private context: GPUCanvasContext;
    private format: GPUTextureFormat;

    private computePipeline!: GPUComputePipeline;
    private toroidalComputePipeline!: GPUComputePipeline;
    private renderPipeline!: GPURenderPipeline;
    private useToroidalShader: boolean = false;
    private computeBindGroup!: GPUBindGroup;
    private renderBindGroup!: GPUBindGroup;
    // Era 2088: Pre-allocated bind group pool to eliminate per-frame allocation
    private computeBindGroupV2A!: GPUBindGroup;
    private computeBindGroupV2B!: GPUBindGroup;
    private computeBindGroupToroidalA!: GPUBindGroup;
    private computeBindGroupToroidalB!: GPUBindGroup;
    private renderBindGroupA!: GPUBindGroup;
    private renderBindGroupB!: GPUBindGroup;
    // Era 2082: GPU readback batching — throttle snapshot extraction to 10 Hz
    private lastReadbackTime: number = 0;
    private readonly READBACK_INTERVAL_MS: number = 100;
    private cachedSnapshot: Uint8Array | null = null;
    private cachedGoldenTrace: string = "";
    private cachedGoldenTraceNum: number = 0;

    private topologyBuffer!: GPUBuffer;
    private signalsBuffer!: GPUBuffer;
    private intentBuffer!: GPUBuffer;
    private agentsBufferA!: GPUBuffer;
    private agentsBufferB!: GPUBuffer;
    private stagingAgentsBuffer!: GPUBuffer;
    private agentsPingPong: number = 0; // 0 = A is source, B is target; 1 = vice versa
    private sineLutBuffer!: GPUBuffer;
    
    // Era 4000: Global Order Parameter Feedback Loop
    private newMeanFieldBuffer!: GPUBuffer;
    private oldMeanFieldBuffer!: GPUBuffer;
    private attractorBuffer!: GPUBuffer;
    private _mouseBound: boolean = false;
    private activeDNSPhase: number = 0; // Era 8000: Target Routing
    private activeOpcode: number = 0;   // Era 8000: Default Safe

    // Era 9000: The Autopoiesis Daemon State
    public daemonState: string = "OBSERVING";
    private lastDaemonTick: number = 0;
    // Era 2082: Replace setTimeout with frame-synchronized polling to avoid timer drift
    private daemonIntentDeadline: number = 0;
    private readonly DAEMON_INTENT_DURATION_MS: number = 500;
    
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

        // 256 elements * 4 bytes (i32) = 1024 bytes — large enough for both Q7 (128)
        // and Q10 (256) LUTs. The correct slice is uploaded in setComputeMode().
        this.sineLutBuffer = this.device.createBuffer({
            size: 1024,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        // Default to Q10 LUT for toroidal shader (exact Rust tick_physics parity)
        this.device.queue.writeBuffer(this.sineLutBuffer, 0, pointers.sineLutQ10Bytes);
        
        // Era 4000: Ping-Pong Global Order Accumulator (8 bytes: i32 Cos, i32 Sin)
        this.newMeanFieldBuffer = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        
        this.oldMeanFieldBuffer = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        // Initialize to zero so first-frame cold-start fallback works correctly
        this.device.queue.writeBuffer(this.oldMeanFieldBuffer, 0, new Uint8Array(8));
        
        // Era 1010: Attractor Array Uniform Buffer (80 bytes)
        this.attractorBuffer = this.device.createBuffer({
            size: 80,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.attractorBuffer, 0, new Uint8Array(80));

        const computeModule = this.device.createShaderModule({ code: computeV2Src });
        const renderModule = this.device.createShaderModule({ code: renderV2Src });
        
        this.computePipeline = await this.device.createComputePipelineAsync({
            layout: 'auto',
            compute: {
                module: computeModule,
                entryPoint: 'compute_main',
            },
        });

        const toroidalModule = this.device.createShaderModule({ code: computeToroidalSrc });
        this.toroidalComputePipeline = await this.device.createComputePipelineAsync({
            layout: 'auto',
            compute: {
                module: toroidalModule,
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

        // Era 2088: Pre-allocate all ping-pong bind groups once
        this.computeBindGroupV2A = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.topologyBuffer } },
                { binding: 1, resource: { buffer: this.signalsBuffer } },
                { binding: 2, resource: { buffer: this.agentsBufferA } },
                { binding: 3, resource: { buffer: this.sineLutBuffer } },
                { binding: 4, resource: { buffer: this.intentBuffer } },
                { binding: 5, resource: { buffer: this.newMeanFieldBuffer } },
                { binding: 6, resource: { buffer: this.oldMeanFieldBuffer } },
                { binding: 7, resource: { buffer: this.agentsBufferB } },
                { binding: 8, resource: { buffer: this.attractorBuffer } },
            ],
        });
        this.computeBindGroupV2B = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.topologyBuffer } },
                { binding: 1, resource: { buffer: this.signalsBuffer } },
                { binding: 2, resource: { buffer: this.agentsBufferB } },
                { binding: 3, resource: { buffer: this.sineLutBuffer } },
                { binding: 4, resource: { buffer: this.intentBuffer } },
                { binding: 5, resource: { buffer: this.newMeanFieldBuffer } },
                { binding: 6, resource: { buffer: this.oldMeanFieldBuffer } },
                { binding: 7, resource: { buffer: this.agentsBufferA } },
                { binding: 8, resource: { buffer: this.attractorBuffer } },
            ],
        });
        this.computeBindGroupToroidalA = this.device.createBindGroup({
            layout: this.toroidalComputePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.topologyBuffer } },
                { binding: 1, resource: { buffer: this.signalsBuffer } },
                { binding: 2, resource: { buffer: this.agentsBufferA } },
                { binding: 3, resource: { buffer: this.sineLutBuffer } },
                { binding: 7, resource: { buffer: this.agentsBufferB } },
                { binding: 8, resource: { buffer: this.attractorBuffer } },
            ],
        });
        this.computeBindGroupToroidalB = this.device.createBindGroup({
            layout: this.toroidalComputePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.topologyBuffer } },
                { binding: 1, resource: { buffer: this.signalsBuffer } },
                { binding: 2, resource: { buffer: this.agentsBufferB } },
                { binding: 3, resource: { buffer: this.sineLutBuffer } },
                { binding: 7, resource: { buffer: this.agentsBufferA } },
                { binding: 8, resource: { buffer: this.attractorBuffer } },
            ],
        });
        this.renderBindGroupA = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.topologyBuffer } },
                { binding: 1, resource: { buffer: this.signalsBuffer } },
                { binding: 2, resource: { buffer: this.agentsBufferA } },
            ],
        });
        this.renderBindGroupB = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.topologyBuffer } },
                { binding: 1, resource: { buffer: this.signalsBuffer } },
                { binding: 2, resource: { buffer: this.agentsBufferB } },
            ],
        });

        // Ensure Daemon starts quietly
        this.lastDaemonTick = performance.now();

        console.log("✅ [V2-WEBGPU] Pipeline Assembled.");
    }

    public setComputeMode(mode: 'v2' | 'toroidal') {
        this.useToroidalShader = mode === 'toroidal';
        const ptrs = this.engine.getMemoryPointers();
        if (this.useToroidalShader) {
            // Era 0201: Q10 LUT (256 elements) for sin_q10 exact parity
            this.device.queue.writeBuffer(this.sineLutBuffer, 0, ptrs.sineLutQ10Bytes);
        } else {
            // Era 950 V2: Q7 LUT (128 elements) with shift-up sampling
            this.device.queue.writeBuffer(this.sineLutBuffer, 0, ptrs.sineLutBytes);
        }
        console.log(`[V2-WEBGPU] Compute mode switched to: ${mode}`);
    }

    public tick() {
        // GPU owns physics: do NOT run CPU tick_physics here.
        // CPU-side WASM is only used for mitosis, resonance, and phi-buffer (via readStateFromGPUAndHash).
        const ptrs = this.engine.getMemoryPointers();

        // Increment absolute_tick in WASM memory so GPU cold-start fallback advances
        const tickView = new DataView(ptrs.uniformBytes.buffer, ptrs.uniformBytes.byteOffset + 16, 16);
        const currentTick = tickView.getUint32(4, true);
        tickView.setUint32(4, currentTick + 1, true);

        this.device.queue.writeBuffer(this.topologyBuffer, 0, ptrs.uniformBytes, 0, 16);
        this.device.queue.writeBuffer(this.signalsBuffer, 0, ptrs.uniformBytes, 16, 16);
        this.device.queue.writeBuffer(this.attractorBuffer, 0, ptrs.attractorBytes, 0, 80);

        // Era 2085: Memory stability guard — if WASM memory grew mid-frame, refresh pointers
        let stablePtrs = ptrs;
        if (this.engine.memoryBuffer !== ptrs.wasmMemoryBuffer) {
            stablePtrs = this.engine.getMemoryPointers();
        }

        const commandEncoder = this.device.createCommandEncoder();
        
        // Ping-pong: determine source (read) and target (write) for this frame
        const computeSource = this.agentsPingPong === 0 ? this.agentsBufferA : this.agentsBufferB;
        const computeTarget = this.agentsPingPong === 0 ? this.agentsBufferB : this.agentsBufferA;
        const renderSource = computeTarget; // Render the freshly computed state
        
        let computePipeline: GPUComputePipeline;
        let computeBindGroup: GPUBindGroup;
        
        if (this.useToroidalShader) {
            // Era 960 Toroidal: exact Rust tick_physics() parity
            computePipeline = this.toroidalComputePipeline;
            computeBindGroup = this.agentsPingPong === 0
                ? this.computeBindGroupToroidalA
                : this.computeBindGroupToroidalB;
        } else {
            // Era 950 V2: mean field + intents + QCD + DNS
            this.device.queue.writeBuffer(this.intentBuffer, 0, stablePtrs.uniformBytes, 32, 128);
            commandEncoder.clearBuffer(this.newMeanFieldBuffer);
            
            computePipeline = this.computePipeline;
            computeBindGroup = this.agentsPingPong === 0
                ? this.computeBindGroupV2A
                : this.computeBindGroupV2B;
        }
        
        const renderBindGroup = this.agentsPingPong === 0
            ? this.renderBindGroupB  // after ping-pong swap, B contains latest
            : this.renderBindGroupA; // after ping-pong swap, A contains latest
        
        // 1. Compute Pass
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(computePipeline);
        passEncoder.setBindGroup(0, computeBindGroup);
        
        const activeCount = new Uint32Array(ptrs.uniformBytes.buffer, ptrs.uniformBytes.byteOffset + 16 + 8, 1)[0];
        const dispatchSize = Math.ceil(activeCount / 64);
        if (dispatchSize > 0) { passEncoder.dispatchWorkgroups(dispatchSize); }
        passEncoder.end();
        
        // ERA 4000: Map the newly reduced Global Vector into the historical reader buffer for the subsequent frame
        // (Only needed for V2 mean-field shader; toroidal shader does not use mean field)
        if (!this.useToroidalShader && dispatchSize > 0) {
            commandEncoder.copyBufferToBuffer(this.newMeanFieldBuffer, 0, this.oldMeanFieldBuffer, 0, 8);
        }
        
        // Ping-pong: swap source/target for next frame
        this.agentsPingPong = 1 - this.agentsPingPong;
        
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
                
                const canvas = (this.context as any).canvas as HTMLCanvasElement;
                if (!(canvas instanceof HTMLCanvasElement)) return;
                const rect = canvas.getBoundingClientRect();
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
        renderPassEncoder.setBindGroup(0, renderBindGroup);
        if (activeCount > 0) { renderPassEncoder.draw(6, activeCount, 0, 0); }
        renderPassEncoder.end();
        
        // Era 2082: Frame-synchronized daemon intent clear (replaces setTimeout drift)
        const now = performance.now();
        if (this.daemonIntentDeadline > 0 && now >= this.daemonIntentDeadline) {
            this.daemonIntentDeadline = 0;
            const clearIntent = this.engine.wasm?.exports.v2_set_intent as CallableFunction | undefined;
            if (clearIntent) clearIntent(1, 0, 0, 0, 0, 0, 0);
        }

        // --- ERA 9000: THE AUTOPOIESIS DAEMON ---
        // Algorithmic Ecosystem Watchdog (Runs dynamically post-render phase)
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
                    this.daemonIntentDeadline = now + this.DAEMON_INTENT_DURATION_MS;
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
                    this.daemonIntentDeadline = now + this.DAEMON_INTENT_DURATION_MS;
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
     * Era 2082: Batched readback — throttled to READBACK_INTERVAL_MS to avoid frame drops.
     */
    public async readStateFromGPUAndHash(): Promise<{ goldenTrace: string, goldenTraceNum: number, snapshot: Uint8Array }> {
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
        // The last written state is the upcoming source (since ping-pong already swapped in tick())
        const currentStateBuffer = this.agentsPingPong === 0 ? this.agentsBufferA : this.agentsBufferB;
        commandEncoder.copyBufferToBuffer(
            currentStateBuffer, 0,
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

    /** Overwrites the entire local GPU state with a WebRTC rollback snapshot */
    public overwriteGPUState(snapshot: Uint8Array) {
        // Write to both buffers so ping-pong is always consistent
        this.device.queue.writeBuffer(this.agentsBufferA, 0, snapshot.buffer as ArrayBuffer, snapshot.byteOffset, snapshot.byteLength);
        this.device.queue.writeBuffer(this.agentsBufferB, 0, snapshot.buffer as ArrayBuffer, snapshot.byteOffset, snapshot.byteLength);
    }
}
