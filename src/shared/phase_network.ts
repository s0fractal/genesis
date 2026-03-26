import { fnv1a_64 } from "@wasm";
import { SENATE_MYCELIUM_MIN_LOCKS, SENATE_MYCELIUM_MIN_ENERGY, MATH_Q_SCALE } from "./constants.ts";

const SYSTEMIC_O56_SALT = "OMEGA_64_VAULT_130_ABSOLUTE_PHASE";

export interface ForeignPlasmid {
    hash: string;
    astStr: string;
    energy: number;
    targetBucket?: number;
    origin?: string;
    parents?: string[];
    signature?: string;
}

function verifyPayloadSignature(p: ForeignPlasmid): boolean {
    const parentStr = p.parents ? p.parents.join(",") : "";
    const expected = fnv1a_64(`${p.hash}:${p.targetBucket}:${p.origin}:${parentStr}:${SYSTEMIC_O56_SALT}`).toString(16);
    return expected === p.signature;
}

export class PhaseNetwork {
    private onPlasmidReceived: (plasmid: ForeignPlasmid) => void;
    public onHaloReceived?: (left: Uint8Array, right: Uint8Array) => void;
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
        } else if (packet.type === "HALO_SYNC") {
            // Era 260 Spatial Data
            // We assume left and right are Base64 encoded or raw arrays if using Zero-Copy ArrayBuffers via DataChannel
            // WebRTC DataChannels handle ArrayBuffer fine, but currently we stringify. So they are likely base64.
            // Wait, for Halo sync we need binary efficiency. In Era 300 we will upgrade the WebRTC mesh data format.
            if (this.onHaloReceived && packet.left && packet.right) {
                try {
                    const leftBuf = new Uint8Array(Object.values(packet.left));
                    const rightBuf = new Uint8Array(Object.values(packet.right));
                    this.onHaloReceived(leftBuf, rightBuf);
                } catch(e) {}
            }
        }
    }

    private validateAndIngestPlasmid(plasmid: ForeignPlasmid) {
        if (this.removeSet.has(plasmid.hash) || this.addSet.has(plasmid.hash)) return;

        if (plasmid.targetBucket !== undefined) {
             const lower = Math.min(this.thetaLimits[0], this.thetaLimits[1]);
             const upper = Math.max(this.thetaLimits[0], this.thetaLimits[1]);
             if (plasmid.targetBucket < lower || plasmid.targetBucket > upper) {
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

    public broadcastHalos(left: Float32Array, right: Float32Array) {
         // Pack float32 to uint8 for transport
         this.broadcastFn({
             type: 'HALO_SYNC',
             origin: this.nodeId,
             left: new Uint8Array(left.buffer),
             right: new Uint8Array(right.buffer)
         });
    }
}
