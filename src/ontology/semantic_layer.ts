
import { fnv1a_64 } from "@wasm";
import { CompostEvent } from "../liquid/compost_consumer.ts";

export class SemanticCoupler {
    private injector: IPerturbationInjector;
    private broadcastCallback?: (plasmid: any) => void;
    
    constructor(injector: IPerturbationInjector, broadcastCallback?: (plasmid: any) => void) {
        this.injector = injector;
        this.broadcastCallback = broadcastCallback;
    }

    // Projects absolute semantic meaning into the physical dimension
    public projectIntent(intent: string) {
        // 1. Hash the semantic string intent into cross-platform deterministic 64-bit topology
        const hash_u64 = fnv1a_64(intent);
        
        // 2. Map BigInt 64-bit into Little-Endian Uint8Array for WebGPU memory bounds
        const view = new DataView(new ArrayBuffer(8));
        view.setBigUint64(0, hash_u64, true); 
        const hashBytes = new Uint8Array(view.buffer);
        
        // 4. Derive energetic disturbance amplitude and topological radius
        const energy = ((hashBytes[4] & 0x0F) + 1) * 100;
        
        // 5. Determine structural mutation parameter
        const phaseShift = hashBytes[6];
        const intentId = Number(hash_u64 & 0xFFFFFFFFn);
        
        // Inject the conceptual perturbation into the lock-free shared physical reality
        this.injector.injectIntent(phaseShift, energy, intentId);
        
        // Era 2070: Broadcast as INTENT plasmid to P2P mesh
        if (this.broadcastCallback) {
            this.broadcastCallback({
                semanticType: "INTENT",
                attractorAddress: intentId,
                matrix: intentId >>> 0, // Using intentId as matrix payload
                inverse: (~intentId) >>> 0,
                pulseAmp: energy,
                pulseFreq: phaseShift,
                recursionDepth: 0,
                maxRecursion: 4,
            });
        }
        
        console.log(`[Σ³] Projected Intent '${intent}' -> Phi(${phaseShift}) : Energy=${energy}, Encoding=${hash_u64.toString(16)}`);
    }

    // Era 2060: Injects the semantic feedback of a deceased agent's compost into the lattice
    public projectCompost(event: CompostEvent) {
        // 1. Hash the deceased agent's genome to map it to a topological resonance
        const hash_u64 = fnv1a_64(event.genome.toString(16));
        
        // 2. Map BigInt 64-bit into Little-Endian Uint8Array
        const view = new DataView(new ArrayBuffer(8));
        view.setBigUint64(0, hash_u64, true); 
        const hashBytes = new Uint8Array(view.buffer);
        
        // 3. Derive spatial coordinates from the hash resonance
        const x = (hashBytes[0] ^ hashBytes[1]) % 256;
        const y = (hashBytes[2] ^ hashBytes[3]) % 256;
        
        // 4. Energy at death determines the magnitude of the semantic perturbation
        // Era 2060: Epigenetic Thermodynamics of Death (Rare genomes release more energy)
        const engine = this.injector as any;
        const bias = engine.getEpigeneticBias ? engine.getEpigeneticBias(event.genome % 32) : 1;
        const total = engine.getEpigeneticTotal ? engine.getEpigeneticTotal() : 1;
        const rarityMultiplier = 1.0 + (1.0 - (bias / Math.max(1, total))) * 10.0;
        
        const energy = Math.min((event.energy_at_death || 100) * 2 * rarityMultiplier, 60000);
        const radius = (hashBytes[5] & 0x0F) + 2; // Tighter radius for compost
        
        // 5. Phase shift aligned with the moment of death
        const phaseShift = event.phase & 0xFF;
        
        this.injector.inject(x, y, energy, radius, phaseShift, hashBytes);
        console.log(`[Σ³] Projected Compost (ID:${event.agent_id}) -> Field(${x}, ${y}) : ΔPhase=${phaseShift}, Energy=${energy}, Genome=0x${event.genome.toString(16).toUpperCase()}`);
    }
}
