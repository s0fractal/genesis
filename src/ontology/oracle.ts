import { SemanticCoupler } from "./semantic_layer";

export class SovereignOracle {
    private coupler: SemanticCoupler;
    private sab: SharedArrayBuffer;
    private isRunning: boolean = false;

    // Field offsets based on omega_core/memory.rs layout
    // SIZE is 256 * 256 = 65536. 
    // Field is SoA: x(i16), y(i16), theta_now(u8), theta_f1, theta_f2, theta_f3, omega(u8), energy(u8)
    private readonly SIZE = 65536;
    private energyView: Uint8Array;
    private thetaView: Uint8Array;

    constructor(coupler: SemanticCoupler, sab: SharedArrayBuffer) {
        this.coupler = coupler;
        this.sab = sab;

        // Calculate byte offsets mapping directly to the Rust WASM Struct-of-Arrays memory layout.
        // x(i16) and y(i16) take up 262,144 bytes total.
        // theta_now(u8) starts at byte 262144.
        this.thetaView = new Uint8Array(sab, 262144, this.SIZE);
        
        // Skipping theta_f1..f3 and omega (4 * 65536 = 262144 bytes)
        // energy offset = 262144 + 65536 + 262144 = 589824
        this.energyView = new Uint8Array(sab, 589824, this.SIZE);
    }

    public async boot() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log("[ORACLE] Subconscious LLM telemetry loop ignited.");

        // Loop every 10 seconds asynchronously, reading matrix metrics and injecting LLM thoughts
        while (this.isRunning) {
            await this.sleep(10000);
            await this.contemplate();
        }
    }

    private async contemplate() {
        // 1. Gather Telemetry (Averaging over the mathematical substrate)
        let totalEnergy = 0;
        let activeNodes = 0;
        let phaseSum = 0;

        // Sample every 16th coordinate dimension to rapidly approximate systemic tension
        for (let i = 0; i < this.SIZE; i += 16) { 
            const e = this.energyView[i];
            if (e > 10) {
                totalEnergy += e;
                phaseSum += this.thetaView[i];
                activeNodes++;
            }
        }

        const avgEnergy = activeNodes > 0 ? Math.floor(totalEnergy / activeNodes) : 0;
        const avgPhase = activeNodes > 0 ? Math.floor(phaseSum / activeNodes) : 0;
        // Simulated structural anomaly detection via dynamic offset
        const entropy = activeNodes > 0 ? Math.floor(Math.random() * 100) : 0; 

        console.log(`[ORACLE] Matrix Telemetry -> Tensional Volume: ${activeNodes * 16}, Avg Kinetic: ${avgEnergy}, Avg Phase: ${avgPhase}`);

        const prompt = `
            Task: You are the Subconscious Sovereign Oracle of the OMEGA-64 Continuous Wave-Matrix.
            The geometric field is running autonomously. Generate one abstract Semantic Attractor (max 5 words). 
            This attractor concept will be hashed into an 8-byte plasmid and injected into the matrix to physically shape its liquid topological geometry.
            
            Current Matrix Telemetry:
            - Structural Volume: ${activeNodes * 16} / ${this.SIZE}
            - Background Kinetic Energy: ${avgEnergy} / 255
            - Predominant Phase: ${avgPhase} / 255
            - Structural Entropy Tension: ${entropy}%

            Provide ONLY the semantic concept (e.g., "Coalesce into harmonic macro-structures", "Disperse dense isolated clusters"). No formatting, no quotes.
        `.trim();

        try {
            const OLLAMA_URL = "http://localhost:11434/api/generate";
            const response = await fetch(OLLAMA_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama3",
                    prompt,
                    stream: false
                })
            });

            if (!response.ok) throw new Error("LLM Offline");
            
            const data = await response.json();
            const intent = data.response?.trim().substring(0, 50);

            if (intent) {
                console.log(`[ORACLE] The Matrix Dreams: "${intent}"`);
                // Inject the dreamed attractor plasmid directly into the lock-free shared state array!
                this.coupler.projectIntent(intent);
            }
        } catch (e) {
            console.warn("[ORACLE] LLM connection severed. Matrix defaulting to stochastic dream loops.");
            this.coupler.projectIntent("Survive and multiply");
        }
    }

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
