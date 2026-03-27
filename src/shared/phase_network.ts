import { fnv1a_64 } from "@wasm";
import { SENATE_MYCELIUM_MIN_LOCKS, SENATE_MYCELIUM_MIN_ENERGY, MATH_Q_SCALE } from "./constants.ts";

const SYSTEMIC_O56_SALT = "OMEGA_64_VAULT_130_ABSOLUTE_PHASE";

export interface UniversalCoordinate {
    u: number;
    v: number;
    w: number;
}

export interface ForeignPlasmid {
    hash: string;
    astStr: string;
    energy: number;
    target?: UniversalCoordinate;
    origin?: string;
    parents?: string[];
    signature?: string;
}

function verifyPayloadSignature(p: ForeignPlasmid): boolean {
    const parentStr = p.parents ? p.parents.join(",") : "";
    const targetStr = p.target ? `${p.target.u},${p.target.v},${p.target.w}` : "";
    const expected = fnv1a_64(`${p.hash}:${targetStr}:${p.origin}:${parentStr}:${SYSTEMIC_O56_SALT}`).toString(16);
    return expected === p.signature;
}

export class PhaseNetwork {
    private onPlasmidReceived: (plasmid: ForeignPlasmid) => void;
    public onImpactReceived?: (impact: {x: number, y: number, energy: number, ast_hash: string, signature: string}) => void;
    private broadcastFn: (packet: any) => void;
    public nodeId: string;
    
    // Era 247: Plasmid Delta-State CRDT (LWW-Element Set)
    private addSet: Map<string, ForeignPlasmid> = new Map();
    private removeSet: Map<string, number> = new Map();
    private localVectorClock: Record<string, number> = {};
    public localRefractiveIndex: number = 1.0; 

    // Era 260 Vector II: Spatial Addressing (Macro-Torus Slicing)
    public thetaLimits: [number, number] = [0, 255]; 

    constructor(
        onPlasmidReceived: (plasmid: ForeignPlasmid) => void,
        broadcastFn: (packet: any) => void
    ) {
        this.onPlasmidReceived = onPlasmidReceived;
        this.broadcastFn = broadcastFn;
        this.nodeId = "node_" + Math.random().toString(36).substring(2, 9);
    }

    public broadcastPlasmid(plasmid: ForeignPlasmid) {
        // Delta-State CRDT Merge
        this.addSet.set(plasmid.hash, plasmid);
        this.localVectorClock[this.nodeId] = (this.localVectorClock[this.nodeId] || 0) + 1;
        
        // Push over the proxy mesh (passes through lattice_worker port -> main thread -> WebRTC DataChannel)
        this.broadcastFn({
            type: "FOREIGN_PLASMID",
            payload: plasmid
        });
    }

    public handleIncomingPacket(packet: any) {
        if (packet.type === "FOREIGN_PLASMID") {
            this.validateAndIngestPlasmid(packet.payload);
        } else if (packet.type === "IMPACT_EVENT") {
            if (this.onImpactReceived && packet.payload) {
                this.onImpactReceived(packet.payload);
            }
        }
    }

    private validateAndIngestPlasmid(plasmid: ForeignPlasmid) {
        if (this.removeSet.has(plasmid.hash) || this.addSet.has(plasmid.hash)) return;

        if (plasmid.target !== undefined) {
             const lower = Math.min(this.thetaLimits[0], this.thetaLimits[1]) / 1024.0;
             const upper = Math.max(this.thetaLimits[0], this.thetaLimits[1]) / 1024.0;
             if (plasmid.target.u < lower || plasmid.target.u > upper) {
                 return; // Not our slice
             }
        }

        if (plasmid.energy < SENATE_MYCELIUM_MIN_ENERGY) {
             return; 
        }

        if (plasmid.signature && verifyPayloadSignature(plasmid)) {
             this.addSet.set(plasmid.hash, plasmid);
             this.onPlasmidReceived(plasmid);
        }
    }

    public broadcastImpact(x: number, y: number, energy: number, ast_hash: string, signature: string) {
         this.broadcastFn({
             type: 'IMPACT_EVENT',
             payload: { x, y, energy, ast_hash, signature }
         });
    }

}
