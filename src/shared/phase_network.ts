import { fnv1a_64 } from "@wasm";
import { SENATE_MYCELIUM_MIN_LOCKS, SENATE_MYCELIUM_MIN_ENERGY } from "./constants.ts";

const SYSTEMIC_O56_SALT = "OMEGA_64_VAULT_130_ABSOLUTE_PHASE";

function verifyPayloadSignature(p: ForeignPlasmid): boolean {
    const parentStr = p.parents ? p.parents.join(",") : "";
    const expected = fnv1a_64(`${p.hash}:${p.targetBucket}:${p.origin}:${parentStr}:${SYSTEMIC_O56_SALT}`).toString(16);
    return expected === p.signature;
}

export class PhaseNetwork {
    private channel: BroadcastChannel;
    private meshChannel: BroadcastChannel;
    private rtcConnections: Set<RTCDataChannel> = new Set();
    private geometricMatrix: Map<number, RTCDataChannel> = new Map(); // Era 203: Optical IP abstraction
    public localRefractiveIndex: number = 1.0; // Governed by thermodynamic homeostasis
    private peers: Map<string, RTCPeerConnection> = new Map();
    private onPlasmidReceived: (plasmid: ForeignPlasmid) => void;
    private nodeId: string;
    
    // O-200 Vector 7: WebRTC Jitter Initialization Backoff
    private backoffMs: number;
    
    // O-196 WebRTC Traffic Shaping
    private originRateLimits: Map<string, { count: number, resetAt: number }> = new Map();
    
    // Era 222: Kademlia Spatial DHT Buckets
    private kBuckets: Map<number, Set<string>> = new Map();
    private readonly MAX_PEERS_PER_BUCKET = 3;

    private calculateXorDistance(peerId: string): number {
        // Compute 64-bit FNV1a hash for deterministic logical IDs
        const localHash = fnv1a_64(this.nodeId);
        const remoteHash = fnv1a_64(peerId);
        const distance = localHash ^ remoteHash;
        
        const bin = distance.toString(2);
        return 64 - bin.length; // Bucket index 0 to 63
    }
    
    private checkRateLimit(origin: string): boolean {
        const nowLocal = performance.now();
        let tracker = this.originRateLimits.get(origin);
        if (!tracker || tracker.resetAt < nowLocal) {
            tracker = { count: 0, resetAt: nowLocal + 1000 };
            this.originRateLimits.set(origin, tracker);
        }
        tracker.count++;
        if (tracker.count > 50) return false;
        return true;
    }

    constructor(onPlasmidReceived: (plasmid: ForeignPlasmid) => void) {
        this.onPlasmidReceived = onPlasmidReceived;
        this.nodeId = "node_" + Math.random().toString(36).substring(2, 9);
        this.backoffMs = 100 + Math.random() * 500; // Stochastic initialization bounds
        
        // 🍄 Phase 1: Local Mycelial Fusion (Same-Machine Cross-Tab)
        this.channel = new BroadcastChannel("omega_64_mycelium");
        this.channel.onmessage = (e) => {
            if (e.data && e.data.type === "FOREIGN_PLASMID") {
                const p = e.data.payload as ForeignPlasmid;
                
                // O-48 & O-56: Payload & Identity Authentication
                if (typeof p.locks !== 'number' || typeof p.energy !== 'number' || 
                    p.locks <= SENATE_MYCELIUM_MIN_LOCKS || 
                    p.energy <= SENATE_MYCELIUM_MIN_ENERGY ||
                    !verifyPayloadSignature(p)) {
                    console.log(`🛡️ [Mycelium Firewall] DETECTED MALICIOUS/LOCAL PLASMID from ${p.origin}. Exhibiting Phantom Trace Protocol.`);
                    // O-196: Phantom Traces & Ethical Immunity. Exile to Shadow Buckets (1000-1024)
                    p.targetBucket = 1000 + Math.floor(Math.random() * 25);
                    this.onPlasmidReceived(p);
                    return;
                }
                
                console.log(`📡 [Mycelium] Received & Verified Authentic Plasmid via Local Broadcast: ${p.hash}`);
                this.onPlasmidReceived(p);
            }
        };

        // 🍄 Phase 2: Automatic Mycelium (WebRTC Auto-Signaling via Mesh)
        this.meshChannel = new BroadcastChannel("omega64-mesh");
        this.meshChannel.onmessage = async (e) => await this.handleMeshSignal(e.data);
        
        // Announce presence to the local mesh
        this.meshChannel.postMessage({ type: "HELLO", origin: this.nodeId });
    }

    private async handleMeshSignal(msgData: unknown) {
        const msg = msgData as { type?: string, origin?: string, target?: string, sdp?: RTCSessionDescriptionInit, candidate?: RTCIceCandidateInit };
        if (!msg || !msg.origin || msg.origin === this.nodeId) return;

        // Era 222: Kademlia XOR Distance Evaluation
        const distanceBucket = this.calculateXorDistance(msg.origin);
        let bucket = this.kBuckets.get(distanceBucket);
        if (!bucket) {
            bucket = new Set();
            this.kBuckets.set(distanceBucket, bucket);
        }

        if (msg.type === "HELLO") {
            // A new peer appeared! We will initiate the connection as the Caller.
            if (!this.peers.has(msg.origin)) {
                
                if (bucket.size >= this.MAX_PEERS_PER_BUCKET) {
                    return; // 🛑 Silently reject to enforce biological sparsity DHT limits
                }
                
                // O-200 Vector 7: Jitter delay to prevent thundering herd when > 3 peers exist
                const delay = this.peers.size > 3 ? this.backoffMs * Math.random() * 3 : 0;
                
                setTimeout(async () => {
                    // Re-verify after backoff
                    if (this.peers.has(msg.origin!)) return;
                    
                    console.log(`🍄 [Auto-Mycelium] Detected peer ${msg.origin} at XOR Bucket ${distanceBucket}. Initiating DHT Handshake...`);
                    const pc = this.createPeerConnection(msg.origin!);
                    const dc = pc.createDataChannel("mycelium_vector");
                    this.bindDataChannel(dc);
    
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    this.meshChannel.postMessage({ type: "OFFER", origin: this.nodeId, target: msg.origin, sdp: pc.localDescription });
                }, delay);
            }
        } 
        else if (msg.type === "OFFER" && msg.target === this.nodeId) {
            if (!this.peers.has(msg.origin) && bucket.size >= this.MAX_PEERS_PER_BUCKET) {
                 return; // 🛑 Reject inbound mesh flood
            }
            
            console.log(`🍄 [Auto-Mycelium] Answering WebRTC DHT Offer from ${msg.origin} (Bucket ${distanceBucket})...`);
            const pc = this.createPeerConnection(msg.origin!);
            pc.ondatachannel = (e) => this.bindDataChannel(e.channel);
            
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp!));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this.meshChannel.postMessage({ type: "ANSWER", origin: this.nodeId, target: msg.origin, sdp: pc.localDescription });
        }
        else if (msg.type === "ANSWER" && msg.target === this.nodeId) {
            const pc = this.peers.get(msg.origin!);
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp!));
            }
        }
        else if (msg.type === "ICE" && msg.target === this.nodeId) {
            const pc = this.peers.get(msg.origin!);
            if (pc && msg.candidate) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                } catch (e) {
                    console.error("Error adding ICE candidate:", e);
                }
            }
        }
    }

    private createPeerConnection(remotePeerId: string): RTCPeerConnection {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        this.peers.set(remotePeerId, pc);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.meshChannel.postMessage({
                    type: "ICE",
                    origin: this.nodeId,
                    target: remotePeerId,
                    candidate: event.candidate.toJSON()
                });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                const distanceBucket = this.calculateXorDistance(remotePeerId);
                const bucket = this.kBuckets.get(distanceBucket);
                if (bucket) bucket.add(remotePeerId);
            }
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                this.peers.delete(remotePeerId);
                const distanceBucket = this.calculateXorDistance(remotePeerId);
                const bucket = this.kBuckets.get(distanceBucket);
                if (bucket) bucket.delete(remotePeerId);
            }
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                console.warn(`🍄 [Auto-Mycelium] WebRTC ICE connection failed with ${remotePeerId}. Triggering ICE Restart...`);
                pc.restartIce();
            }
        };

        return pc;
    }

    // Broadcast a mutated idea to all connected mycelial nodes via Holographic Refraction
    public broadcastPlasmid(hash: string, targetBucket: number, locks: number, energy: number, parents?: string[], vectorClock?: Record<string, number>) {
        const origin = "peer_" + Math.random().toString(36).substring(7);
        const parentStr = parents ? parents.join(",") : "";
        const signature = fnv1a_64(`${hash}:${targetBucket}:${origin}:${parentStr}:${SYSTEMIC_O56_SALT}`).toString(16);
        const payload: ForeignPlasmid = { hash, targetBucket, origin, locks, energy, signature, parents, vectorClock };
        
        // Emitting internally locally ignores geometry
        const localMsg = { type: "FOREIGN_PLASMID", payload };
        this.channel.postMessage(localMsg);

        // Era 203: Global Emission as a Phase Wave
        const startingTheta = Math.random() * Math.PI * 2;
        const startingAmplitude = Math.max(1000, energy * 10);
        this.refractPlasmid(payload, startingTheta, startingAmplitude);
    }
    
    // Era 203: Snell's Law Geometric Proxy
    private refractPlasmid(p: ForeignPlasmid, thetaOut: number, amplitude: number, excludeDc?: RTCDataChannel) {
        if (this.geometricMatrix.size === 0) return;
        
        let bestDc: RTCDataChannel | null = null;
        let minDiff = Infinity;
        
        // Find the WebRTC pipe that geometrically aligns best with the refracted angle
        for (const [theta, dc] of this.geometricMatrix.entries()) {
            if (dc === excludeDc) continue;
            
            let diff = Math.abs(theta - thetaOut);
            if (diff > Math.PI) diff = 2 * Math.PI - diff; // Circular Wrap
            
            if (diff < minDiff) {
                minDiff = diff;
                bestDc = dc;
            }
        }
        
        if (bestDc && bestDc.readyState === "open") {
            const msg = { type: "FOREIGN_PLASMID", payload: p, theta: thetaOut, amplitude };
            bestDc.send(JSON.stringify(msg));
        }
    }

    // Extensible API for manual WebRTC STUN handshakes (O-45 Phase 2)
    public async generateOffer(): Promise<string> {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        const dc = pc.createDataChannel("mycelium_vector");
        this.bindDataChannel(dc);
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        return new Promise((resolve) => {
            pc.onicecandidate = (e) => {
                if (!e.candidate) resolve(btoa(JSON.stringify(pc.localDescription)));
            };
        });
    }

    public async acceptOffer(base64Offer: string): Promise<string> {
        const offer = JSON.parse(atob(base64Offer));
        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        
        pc.ondatachannel = (e) => this.bindDataChannel(e.channel);
        
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        return new Promise((resolve) => {
            pc.onicecandidate = (e) => {
                if (!e.candidate) resolve(btoa(JSON.stringify(pc.localDescription)));
            };
        });
    }

    private bindDataChannel(dc: RTCDataChannel) {
        dc.onopen = () => {
            console.log(`🌐 [WebRTC] Global Phase Node connected!`);
            this.rtcConnections.add(dc);
            // Era 226: Deterministic WebRTC Topology Route (Perfect Radial Slices)
            const theta = (this.geometricMatrix.size / 8.0) * Math.PI * 2;
            this.geometricMatrix.set(theta, dc);
        };
        dc.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data && data.type === "FOREIGN_PLASMID") {
                    const p = data.payload as ForeignPlasmid;
                    
                    // O-196 WebRTC Traffic Shaping (DDoS Armor)
                    if (!this.checkRateLimit(p.origin)) {
                        console.warn(`🛑 [WebRTC DDoS Armor] Peer ${p.origin} exceeded 50 plasmids/sec. Dropping connection.`);
                        dc.close();
                        return;
                    }

                    // O-48 & O-56: Payload & Identity Authentication
                    if (typeof p.locks !== 'number' || typeof p.energy !== 'number' || 
                        p.locks <= SENATE_MYCELIUM_MIN_LOCKS || 
                        p.energy <= SENATE_MYCELIUM_MIN_ENERGY ||
                        !verifyPayloadSignature(p)) {
                        console.log(`🛡️ [WebRTC Firewall] DETECTED MALICIOUS PLASMID from ${p.origin}. Exhibiting Phantom Trace Protocol.`);
                        // O-196: Phantom Traces & Ethical Immunity. Exile to Shadow Buckets (1000-1024)
                        p.targetBucket = 1000 + Math.floor(Math.random() * 25);
                        this.onPlasmidReceived(p);
                        return;
                    }
                    // Era 203: Wave Propagation & Snell's Law
                    const theta_in = data.theta || 0;
                    let currentAmplitude = data.amplitude || 1000;
                    
                    // The wave loses energy as it travels through the geometric internet
                    currentAmplitude *= 0.8; 
                    
                    if (currentAmplitude > 100) {
                        
                        // Era 216 Vector 3: Thermodynamic Routing (Shadow Shunts)
                        // Active fail-safe to prevent DDoS collapse when the local matrix is heavily saturated
                        if (this.localRefractiveIndex > 5.0 && Math.random() > 0.3) {
                            console.log(`🕳️ [Thermodynamic Routing] High local entropy (${this.localRefractiveIndex.toFixed(2)}). Absorbing Wave ${p.hash.substring(0,8)} into Shadow Bucket.`);
                            p.targetBucket = 1000 + Math.floor(Math.random() * 25);
                            this.onPlasmidReceived(p);
                            return; // Terminate geometric propagation (absorb completely)
                        }

                        // Snell's Law calculation: n1 * sin(theta_in) = n2 * sin(theta_out)
                        // Assuming vacuum n1 = 1.0; n2 = localRefractiveIndex (Entropy Density)
                        let sin_out = (1.0 / this.localRefractiveIndex) * Math.sin(theta_in);
                        
                        // Total Internal Reflection constraints
                        if (sin_out > 1) sin_out = 1;
                        if (sin_out < -1) sin_out = -1;
                        
                        const theta_out = Math.asin(sin_out);
                        
                        // Propagate the wave onward without stopping
                        this.refractPlasmid(p, theta_out, currentAmplitude, dc);
                        console.log(`🌈 [Refraction] Proxied plasmid ${p.hash} at angle ${theta_out.toFixed(2)} rad. Amp: ${currentAmplitude.toFixed(0)}`);
                    }

                    // 🍄 Era 203: Holographic CRDT Resonance
                    // Even as the wave passes through us, we attempt to biologically absorb it
                    console.log(`📡 [Holo-CRDT] Attempting to resonate with plasmid: ${p.hash}`);
                    this.onPlasmidReceived(p);
                }
            } catch (_err) {
                // Ignore malformed WebRTC frames
            }
        };
        dc.onclose = () => {
            this.rtcConnections.delete(dc);
            for (const [theta, channel] of this.geometricMatrix.entries()) {
                if (channel === dc) this.geometricMatrix.delete(theta);
            }
        };
    }
}
