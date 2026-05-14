import { Libp2pMesh } from "./libp2p_mesh.ts";
import { OmegaV2Engine } from "../environment/v2_bridge.ts";

/**
 * LiquidIntent represents the semantic intent arriving from the Liquid Substrate.
 */
export interface LiquidIntent {
    intent: string;
    agentId?: string;
    declaredValues?: string[];
    rho: number;
    phaseVector: number[];
}

/**
 * OmegaReceipt represents the physical consensus outcome of an action.
 */
export interface OmegaReceipt {
    status: "ACCEPTED" | "REJECTED" | "PROOF_FAILED" | "MUTATION_APPLIED" | "BOUNDARY_BLOCKED";
    hash: string;
    energyCost: number;
    tau: number;
}

/**
 * PhiBridge: The typed, unidirectional membrane between the Liquid (Semantic) Substrate
 * and the OMEGA-64 (Physical) Substrate.
 */
export class PhiBridge {
    private mesh: Libp2pMesh | null = null;
    private engine: OmegaV2Engine;
    private receiptListeners: ((receipt: OmegaReceipt) => void)[] = [];

    constructor(engine: OmegaV2Engine) {
        this.engine = engine;
    }

    public attachMesh(mesh: Libp2pMesh) {
        this.mesh = mesh;
    }

    /**
     * Liquid calls this to project intent into the physical layer.
     * OMEGA blindly converts this into topological coordinates without parsing semantics.
     */
    public emitIntent(intent: LiquidIntent): void {
        // Hash the semantic string intent into a cross-platform deterministic 32-bit topology attractor
        let hash = 2166136261;
        for (let i = 0; i < intent.intent.length; i++) {
            hash ^= intent.intent.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        const intentId = hash >>> 0;

        // Derive energetic disturbance amplitude from Liquid rho
        const energy = Math.floor(intent.rho * 100);

        // Map 8D phase vector to a single planar 1D phase (0-255)
        const phaseShift = intent.phaseVector.length > 0 ? (Math.floor(intent.phaseVector[0] * 255) & 255) : 0;

        console.log(`[Φ-Bridge] Routing Intent -> Attractor(0x${intentId.toString(16).toUpperCase()}), Energy(${energy}), Phase(${phaseShift})`);

        // Broadcast as an INTENT plasmid to the P2P mesh
        if (this.mesh) {
            this.mesh.enqueuePlasmid({
                semanticType: "INTENT",
                attractorAddress: intentId,
                matrix: intentId,
                inverse: (~intentId) >>> 0,
                pulseAmp: energy,
                pulseFreq: phaseShift,
                recursionDepth: 0,
                maxRecursion: 4,
            });
        }
    }

    /**
     * Liquid subscribes to physical receipts via this callback.
     */
    public onPhysicsReceipt(callback: (receipt: OmegaReceipt) => void): void {
        this.receiptListeners.push(callback);
    }

    /**
     * Internal OMEGA call to dispatch a physical receipt back across the bridge.
     */
    public dispatchReceipt(receipt: OmegaReceipt): void {
        for (const listener of this.receiptListeners) {
            listener(receipt);
        }
    }
}
