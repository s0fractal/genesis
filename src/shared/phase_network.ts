import { fnv1a_64 } from "./hash.ts";
import { SENATE_MYCELIUM_MIN_LOCKS, SENATE_MYCELIUM_MIN_ENERGY } from "./constants.ts";

const SYSTEMIC_O56_SALT = "OMEGA_64_VAULT_130_ABSOLUTE_PHASE";

function verifyPayloadSignature(p: ForeignPlasmid): boolean {
    const expected = fnv1a_64(`${p.hash}:${p.targetBucket}:${p.origin}:${SYSTEMIC_O56_SALT}`).toString(16);
    return expected === p.signature;
}

export class PhaseNetwork {
    private channel: BroadcastChannel;
    private meshChannel: BroadcastChannel;
    private rtcConnections: Set<RTCDataChannel> = new Set();
    private peers: Map<string, RTCPeerConnection> = new Map();
    private onPlasmidReceived: (plasmid: ForeignPlasmid) => void;
    private nodeId: string;

    constructor(onPlasmidReceived: (plasmid: ForeignPlasmid) => void) {
        this.onPlasmidReceived = onPlasmidReceived;
        this.nodeId = "node_" + Math.random().toString(36).substring(2, 9);
        
        // 🍄 Phase 1: Local Mycelial Fusion (Same-Machine Cross-Tab)
        this.channel = new BroadcastChannel("omega_64_mycelium");
        this.channel.onmessage = (e) => {
            if (e.data && e.data.type === "FOREIGN_PLASMID") {
                const p = e.data.payload as ForeignPlasmid;
                
                // O-48 & O-56: Payload & Identity Authentication
                if (typeof p.locks !== 'number' || typeof p.energy !== 'number' || 
                    p.locks <= SENATE_MYCELIUM_MIN_LOCKS || 
                    p.energy <= SENATE_MYCELIUM_MIN_ENERGY) {
                    console.log(`🛡️ [Mycelium Firewall] Rejected Local Transmission. Insufficient Biological Proof-of-Work (Locks: ${p.locks}, ATP: ${p.energy}).`);
                    return;
                }
                if (!verifyPayloadSignature(p)) {
                    console.log(`🛡️ [Mycelium Firewall] BLOCKED: Malicious Intent Detected. Forged Cryptographic Capability Token from ${p.origin}.`);
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

    private async handleMeshSignal(msg: any) {
        if (!msg || msg.origin === this.nodeId) return;

        if (msg.type === "HELLO") {
            // A new peer appeared! We will initiate the connection as the Caller.
            if (!this.peers.has(msg.origin)) {
                console.log(`🍄 [Auto-Mycelium] Detected new peer ${msg.origin}. Initiating WebRTC Handshake...`);
                const pc = this.createPeerConnection(msg.origin);
                const dc = pc.createDataChannel("mycelium_vector");
                this.bindDataChannel(dc);

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                this.meshChannel.postMessage({ type: "OFFER", origin: this.nodeId, target: msg.origin, sdp: pc.localDescription });
            }
        } 
        else if (msg.type === "OFFER" && msg.target === this.nodeId) {
            console.log(`🍄 [Auto-Mycelium] Answering WebRTC Offer from ${msg.origin}...`);
            const pc = this.createPeerConnection(msg.origin);
            pc.ondatachannel = (e) => this.bindDataChannel(e.channel);
            
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this.meshChannel.postMessage({ type: "ANSWER", origin: this.nodeId, target: msg.origin, sdp: pc.localDescription });
        }
        else if (msg.type === "ANSWER" && msg.target === this.nodeId) {
            const pc = this.peers.get(msg.origin);
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            }
        }
        else if (msg.type === "ICE" && msg.target === this.nodeId) {
            const pc = this.peers.get(msg.origin);
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
                    candidate: event.candidate
                });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                this.peers.delete(remotePeerId);
            }
        };

        return pc;
    }

    // Broadcast a mutated idea to all connected mycelial nodes (Local & Remote)
    public broadcastPlasmid(hash: string, targetBucket: number, locks: number, energy: number) {
        const origin = "peer_" + Math.random().toString(36).substring(7);
        const signature = fnv1a_64(`${hash}:${targetBucket}:${origin}:${SYSTEMIC_O56_SALT}`).toString(16);
        const payload: ForeignPlasmid = { hash, targetBucket, origin, locks, energy, signature };
        const msg = { type: "FOREIGN_PLASMID", payload };
        
        // Emit locally
        this.channel.postMessage(msg);

        // Emit globally over WebRTC
        const serialized = JSON.stringify(msg);
        for (const rtc of this.rtcConnections) {
            if (rtc.readyState === "open") {
                rtc.send(serialized);
            }
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
        };
        dc.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data && data.type === "FOREIGN_PLASMID") {
                    const p = data.payload as ForeignPlasmid;
                    
                    // O-48 & O-56: Payload & Identity Authentication
                    if (typeof p.locks !== 'number' || typeof p.energy !== 'number' || 
                        p.locks <= SENATE_MYCELIUM_MIN_LOCKS || 
                        p.energy <= SENATE_MYCELIUM_MIN_ENERGY) {
                        console.log(`🛡️ [WebRTC Firewall] Rejected Global Transmission. Insufficient Proof-of-Work (Locks: ${p.locks}, ATP: ${p.energy}).`);
                        return;
                    }
                    if (!verifyPayloadSignature(p)) {
                        console.log(`🛡️ [WebRTC Firewall] FATAL BLOCKED: Incoming Cross-Machine Transmission forged Cryptographic Signature. Isolating peer ${p.origin}.`);
                        return;
                    }
                    
                    console.log(`📡 [WebRTC] Received Cryptographically Verified Global Plasmid: ${p.hash}`);
                    this.onPlasmidReceived(p);
                }
            } catch (_err) {}
        };
        dc.onclose = () => this.rtcConnections.delete(dc);
    }
}
