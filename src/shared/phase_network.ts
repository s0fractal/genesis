export interface ForeignPlasmid {
    hash: string;
    targetBucket: number;
    origin: string;
}

export class PhaseNetwork {
    private channel: BroadcastChannel;
    private rtcConnections: Set<RTCDataChannel> = new Set();
    private onPlasmidReceived: (plasmid: ForeignPlasmid) => void;

    constructor(onPlasmidReceived: (plasmid: ForeignPlasmid) => void) {
        this.onPlasmidReceived = onPlasmidReceived;
        
        // 🍄 Phase 1: Local Mycelial Fusion (Same-Machine Cross-Tab)
        this.channel = new BroadcastChannel("omega_64_mycelium");
        this.channel.onmessage = (e) => {
            if (e.data && e.data.type === "FOREIGN_PLASMID") {
                console.log(`📡 [Mycelium] Received Foreign Plasmid via Local Broadcast: ${e.data.payload.hash}`);
                this.onPlasmidReceived(e.data.payload);
            }
        };
    }

    // Broadcast a mutated idea to all connected mycelial nodes (Local & Remote)
    public broadcastPlasmid(hash: string, targetBucket: number) {
        const payload = { hash, targetBucket, origin: "peer_" + Math.random().toString(36).substring(7) };
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
                    console.log(`📡 [WebRTC] Received Foreign Plasmid: ${data.payload.hash}`);
                    this.onPlasmidReceived(data.payload);
                }
            } catch (err) {}
        };
        dc.onclose = () => this.rtcConnections.delete(dc);
    }
}
