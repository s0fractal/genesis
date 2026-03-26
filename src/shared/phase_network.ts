import { createLibp2p, Libp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { webTransport } from '@libp2p/webtransport';
import { noise } from '@chainsafe/libp2p-noise';
import { kadDHT } from '@libp2p/kad-dht';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { yamux } from '@libp2p/yamux';
import { createHelia } from 'helia';
import { strings } from '@helia/strings';
import { fnv1a_64 } from "@wasm";
import { SENATE_MYCELIUM_MIN_LOCKS, SENATE_MYCELIUM_MIN_ENERGY, MATH_Q_SCALE } from "./constants.ts";

const SYSTEMIC_O56_SALT = "OMEGA_64_VAULT_130_ABSOLUTE_PHASE";

function verifyPayloadSignature(p: ForeignPlasmid): boolean {
    const parentStr = p.parents ? p.parents.join(",") : "";
    const expected = fnv1a_64(`${p.hash}:${p.targetBucket}:${p.origin}:${parentStr}:${SYSTEMIC_O56_SALT}`).toString(16);
    return expected === p.signature;
}

export class PhaseNetwork {
    private node: Libp2p | null = null;
    // deno-lint-ignore no-explicit-any
    private helia: any | null = null;
    // deno-lint-ignore no-explicit-any
    private heliaStrings: any | null = null;
    private onPlasmidReceived: (plasmid: ForeignPlasmid) => void;
    public onHaloReceived?: (left: Uint8Array, right: Uint8Array) => void;
    private channel: BroadcastChannel;
    public nodeId: string;
    
    // Era 247: Plasmid Delta-State CRDT (LWW-Element Set)
    private addSet: Map<string, ForeignPlasmid> = new Map();
    private removeSet: Map<string, number> = new Map();
    private localVectorClock: Record<string, number> = {};
    private gossipIntervalId: number | null = null;
    public localRefractiveIndex: number = 1.0; 

    // Era 260 Vector II: Spatial Addressing (Macro-Torus Slicing)
    public thetaLimits: [number, number] = [0, 255]; 

    constructor(onPlasmidReceived: (plasmid: ForeignPlasmid) => void) {
        this.onPlasmidReceived = onPlasmidReceived;
        this.nodeId = "node_" + Math.random().toString(36).substring(2, 9);
        
        // 🍄 Phase 1: Local Mycelial Fusion (Same-Machine Cross-Tab)
        this.channel = new BroadcastChannel("omega_64_mycelium");
        this.channel.onmessage = (e) => {
            if (e.data && e.data.type === "FOREIGN_PLASMID") {
                this.validateAndIngestPlasmid(e.data.payload);
            }
        };
        
        this.initLibp2p();
    }

    private async initLibp2p() {
        this.node = await createLibp2p({
            addresses: {
                listen: [
                    '/webrtc',
                ]
            },
            transports: [ webSockets(), webTransport() ],
            connectionEncryption: [ noise() ],
            streamMuxers: [ yamux() ],
            services: {
                // deno-lint-ignore no-explicit-any
                dht: kadDHT({ protocol: '/omega-64/kad/1.0.0' }) as any,
                // deno-lint-ignore no-explicit-any
                pubsub: gossipsub({ allowPublishToZeroTopicPeers: true } as any) as any
            }
        });

        await this.node.start();
        console.log(`🌐 [Libp2p Mycelium] Node booted with Spatial Prefix: ${this.node.peerId.toString()}`);
        
        // Era 266: IPFS DHT Pinning (Helia)
        try {
            this.helia = await createHelia({ libp2p: this.node });
            this.heliaStrings = strings(this.helia);
            console.log(`🌌 [Helia DHT] Immutable IPFS node bound to the Libp2p transport.`);
        } catch(e) {
            console.warn(`[Helia DHT] Failed to integrate IPFS pinning:`, e);
        }
        
        // Era 260: Map PeerID hash to a spatial sector inside the Q-Scaled Torus (0 to 1024)
        const dhtHash = fnv1a_64(this.node.peerId.toString());
        const theta_start = Number(dhtHash % BigInt(MATH_Q_SCALE));
        const theta_end = (theta_start + 64) % MATH_Q_SCALE;
        this.thetaLimits = [theta_start, theta_end];
        console.log(`🧭 [Kademlia Routing] Node assumed jurisdiction over Torus Arc: θ[${theta_start}..${theta_end}]`);

        this.node.services.pubsub.subscribe('omega-64-plasmids');
        this.node.services.pubsub.subscribe('omega-64-crdt');
        this.node.services.pubsub.subscribe('omega-64-halo');

        // deno-lint-ignore no-explicit-any
        this.node.services.pubsub.addEventListener('message', (evt: any) => {
            const topic = evt.detail.topic;
            const strData = new TextDecoder().decode(evt.detail.data);
            try {
                const data = JSON.parse(strData);
                if (topic === 'omega-64-plasmids') {
                    this.validateAndIngestPlasmid(data);
                } else if (topic === 'omega-64-crdt') {
                    this.handleInboundCRDT(data);
                } else if (topic === 'omega-64-halo') {
                    if (data.origin !== this.nodeId && this.onHaloReceived) {
                        const l = Uint8Array.from(atob(data.left), c => c.charCodeAt(0));
                        const r = Uint8Array.from(atob(data.right), c => c.charCodeAt(0));
                        this.onHaloReceived(l, r);
                    }
                }
            } catch (_e) {
                // Parse fail ignored
            }
        });

        this.gossipIntervalId = setInterval(() => this.gossipCRDTState(), 8000) as unknown as number;
    }

    private validateAndIngestPlasmid(p: ForeignPlasmid) {
        // O-48 & O-56: Payload & Identity Authentication
        if (typeof p.locks !== 'number' || typeof p.energy !== 'number' || 
            p.locks <= SENATE_MYCELIUM_MIN_LOCKS || 
            p.energy <= SENATE_MYCELIUM_MIN_ENERGY ||
            !verifyPayloadSignature(p)) {
            console.log(`🛡️ [Mycelium Firewall] DETECTED MALICIOUS PLASMID from ${p.origin}. Exhibiting Phantom Trace Protocol.`);
            // O-196: Shadow Buckets
            p.targetBucket = 1000 + Math.floor(Math.random() * 25);
            this.onPlasmidReceived(p);
            return;
        }
        
        const wasNovel = this.mergeCRDTPlasmid(p);
        if (wasNovel) {
             console.log(`📡 [Holo-CRDT] Resonating with plasmid: ${p.hash}`);
        }
    }

    // Era 247: Delta-State CRDT Merge Logic (LWW-Element Set)
    private mergeCRDTPlasmid(p: ForeignPlasmid) {
        const hash = p.hash;
        const removeTimestamp = this.removeSet.get(hash) || 0;
        
        let incomingClockMax = 0;
        if (p.vectorClock) {
            for (const val of Object.values(p.vectorClock)) {
                if (val > incomingClockMax) incomingClockMax = val;
            }
        } else {
            incomingClockMax = performance.now(); 
        }

        if (incomingClockMax > removeTimestamp) {
            const existing = this.addSet.get(hash);
            if (!existing || incomingClockMax > this.getPlasmidClockMax(existing)) {
                this.addSet.set(hash, p);
                this.localVectorClock[this.nodeId] = performance.now();
                this.onPlasmidReceived(p);
                return true;
            }
        }
        return false;
    }
    
    public obliteratePlasmid(hash: string) {
        if (this.addSet.has(hash)) {
            this.addSet.delete(hash);
            this.removeSet.set(hash, performance.now());
            this.localVectorClock[this.nodeId] = performance.now();
        }
    }
    
    private getPlasmidClockMax(p: ForeignPlasmid): number {
        if (!p.vectorClock) return 0;
        let max = 0;
        for (const val of Object.values(p.vectorClock)) {
             if (val > max) max = val;
        }
        return max;
    }

    private gossipCRDTState() {
        if (!this.node) return;
        
        const sortedAdded = Array.from(this.addSet.values())
            .sort((a, b) => this.getPlasmidClockMax(b) - this.getPlasmidClockMax(a))
            .slice(0, 5);
            
        const sortedRemoved = Array.from(this.removeSet.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const deltaPayload = {
            type: "CRDT_SYNC",
            origin: this.nodeId,
            addSet: sortedAdded,
            removeSet: Object.fromEntries(sortedRemoved),
            clock: this.localVectorClock
        };
        
        const msgStr = JSON.stringify(deltaPayload);
        this.node.services.pubsub.publish('omega-64-crdt', new TextEncoder().encode(msgStr)).catch(()=>{});
    }

    // deno-lint-ignore no-explicit-any
    private handleInboundCRDT(data: any) {
        if (!data || data.origin === this.nodeId) return;
        
        const remoteRemoveSet = data.removeSet as Record<string, number>;
        const remoteAddSet = data.addSet as ForeignPlasmid[];
        
        let mergedCount = 0;
        
        for (const [hash, timestamp] of Object.entries(remoteRemoveSet)) {
            const localTS = this.removeSet.get(hash) || 0;
            if (timestamp > localTS) {
                this.removeSet.set(hash, timestamp);
                this.addSet.delete(hash);
            }
        }
        
        for (const plasmid of remoteAddSet) {
            if (this.mergeCRDTPlasmid(plasmid)) mergedCount++;
        }
        
        if (mergedCount > 0) {
            console.log(`🧬 [CRDT_SYNC] Merged ${mergedCount} causal plasmids from ${data.origin}`);
            this.localVectorClock[data.origin] = Math.max(
                this.localVectorClock[data.origin] || 0, 
                (data.clock && data.clock[data.origin]) ? data.clock[data.origin] : 0
            );
        }
    }

    // Broadcast a mutated idea to all connected mycelial nodes via GossipSub
    public broadcastPlasmid(hash: string, targetBucket: number, locks: number, energy: number, parents?: string[], vectorClock?: Record<string, number>, phenotype?: NetworkPhenotype) {
        const origin = "peer_" + Math.random().toString(36).substring(7);
        const parentStr = parents ? parents.join(",") : "";
        const signature = fnv1a_64(`${hash}:${targetBucket}:${origin}:${parentStr}:${SYSTEMIC_O56_SALT}`).toString(16);
        const seedClock = vectorClock || { [this.nodeId]: performance.now() };
        const payload: ForeignPlasmid = { hash, targetBucket, origin, locks, energy, signature, parents, vectorClock: seedClock, phenotype };
        
        this.addSet.set(hash, payload);
        this.localVectorClock[this.nodeId] = performance.now();

        // Local UI broadcast
        const localMsg = { type: "FOREIGN_PLASMID", payload };
        this.channel.postMessage(localMsg);

        // Global Libp2p Gossip broadcast
        if (this.node) {
            const rawMsg = new TextEncoder().encode(JSON.stringify(payload));
            this.node.services.pubsub.publish('omega-64-plasmids', rawMsg).catch(()=>{});
        }
    }

    // Era 260: Transpose WebGPU grid edges across the Macro-Torus
    public broadcastHalos(left: Uint8Array, right: Uint8Array) {
        if (!this.node) return;
        
        let lBin = '';
        for (let i = 0; i < left.length; i++) lBin += String.fromCharCode(left[i]);
        let rBin = '';
        for (let i = 0; i < right.length; i++) rBin += String.fromCharCode(right[i]);
        
        const payload = JSON.stringify({
            type: "HALO_SYNC", 
            origin: this.nodeId, 
            left: btoa(lBin), 
            right: btoa(rBin) 
        });
        
        this.node.services.pubsub.publish('omega-64-halo', new TextEncoder().encode(payload)).catch(()=>{});
    }

    // Era 266: IPFS Eternal Pinning
    public async pinPlasmid(hash: string, ast: string) {
        if (!this.heliaStrings) return;
        try {
            const payload = JSON.stringify({ hash, ast, timestamp: Date.now(), sector: this.thetaLimits });
            const cid = await this.heliaStrings.add(payload);
            console.log(`💎 [IPFS PIN] Eternalized Plasmid [${hash.substring(0,8)}] at CID: ${cid.toString()}`);
            return cid.toString();
        } catch (e) {
            console.warn(`[IPFS PIN] Failed to persist mathematical topology:`, e);
            return null;
        }
    }
}
