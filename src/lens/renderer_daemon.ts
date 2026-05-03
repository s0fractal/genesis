import { OmegaV2Engine } from '../environment/v2_bridge.ts';

export class RendererDaemon {
    private engine: OmegaV2Engine;
    private context: GPUCanvasContext;

    public daemonState: string = "OBSERVING";
    private lastDaemonTick: number = 0;
    private daemonIntentDeadline: number = 0;
    private readonly DAEMON_INTENT_DURATION_MS: number = 500;
    
    private activeGodWord: string = "GENESIS";
    private activeGodHash: number = 0;
    private activeDNSPhase: number = 0; 
    private activeOpcode: number = 0;   
    private _mouseBound: boolean = false;

    constructor(context: GPUCanvasContext, engine: OmegaV2Engine) {
        this.context = context;
        this.engine = engine;
    }

    private djb2Hash(str: string): number {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
        }
        return hash >>> 0;
    }

    public bindGlobalEvents() {
        if (this._mouseBound) return;
        this._mouseBound = true;
        
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
            
            if (isGodMode) {
                packedMass = 3000; 
                semanticGenome = this.activeGodHash;
                const HUD_ELEM = document.getElementById("hud-stat-c-val");
                if (HUD_ELEM) HUD_ELEM.innerText = `[LOGOS INJECTION]: ${this.activeGodWord}`;
            } else {
                const payload = this.activeOpcode; 
                const baseMass = 2000; 
                packedMass = (payload << 24) | (this.activeDNSPhase << 16) | baseMass;
                semanticGenome = 0;
            }
            
            if ((globalThis as unknown as { _v2Mesh: any })._v2Mesh) {
                (globalThis as unknown as { _v2Mesh: any })._v2Mesh.__lastLocalIntent = { x: ix, y: iy, m: packedMass, r: 200, g: semanticGenome, op: opMode };
            }
            
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

    public evaluate(activeCount: number) {
        const now = performance.now();
        
        // Frame-synchronized daemon intent clear
        if (this.daemonIntentDeadline > 0 && now >= this.daemonIntentDeadline) {
            this.daemonIntentDeadline = 0;
            const clearIntent = this.engine.wasm?.exports.v2_set_intent as CallableFunction | undefined;
            if (clearIntent) clearIntent(1, 0, 0, 0, 0, 0, 0);
        }

        // Algorithmic Ecosystem Watchdog
        if (now - this.lastDaemonTick > 2000) {
            this.lastDaemonTick = now;
            const setIntent = this.engine.wasm?.exports.v2_set_intent as CallableFunction | undefined;
            
            if (setIntent) {
                if (activeCount < 100000) {
                    this.daemonState = "INTERVENING (GENESIS)";
                    const gx = Math.floor(Math.random() * window.innerWidth);
                    const gy = Math.floor(Math.random() * window.innerHeight);
                    let hash = 5381;
                    const word = "AUTOPOIESIS";
                    for (let i = 0; i < word.length; i++) hash = ((hash << 5) + hash) + word.charCodeAt(i);
                    setIntent(1, gx, gy, 0, 400, hash >>> 0, 1);
                    this.daemonIntentDeadline = now + this.DAEMON_INTENT_DURATION_MS;
                } else if (activeCount > 900000) {
                    this.daemonState = "INTERVENING (CULLING)";
                    const gx = Math.floor(Math.random() * window.innerWidth);
                    const gy = Math.floor(Math.random() * window.innerHeight);
                    const packedMass = (3 << 24) | (0 << 16) | 2000;
                    setIntent(1, gx, gy, packedMass, 300, 0, 0);
                    this.daemonIntentDeadline = now + this.DAEMON_INTENT_DURATION_MS;
                } else {
                    this.daemonState = "OBSERVING";
                    setIntent(1, 0, 0, 0, 0, 0, 0);
                }
            }
        }
    }
}
