// OMEGA-64 Era 300: Native WebRTC Mesh
// Runs on the Main Thread (DOM) and relays to the Phase SharedWorker

export class WebRTCMesh {
    private signaling: WebSocket;
    private peers: Map<string, RTCPeerConnection> = new Map();
    private channels: Map<string, RTCDataChannel> = new Map();
    private workerPort: MessagePort;
    private localId: string = "";

    constructor(workerPort: MessagePort, signalingUrl: string = "ws://localhost:9091") {
        this.workerPort = workerPort;
        this.signaling = new WebSocket(signalingUrl);

        this.signaling.onmessage = this.handleSignalingMessage.bind(this);
        this.signaling.onopen = () => console.log(`[WebRTCMesh] Connected to Signaling Star.`);
        this.signaling.onerror = (e) => console.warn(`[WebRTCMesh] Signaling failed (Start the Deno relay):`, e);
    }

    private async handleSignalingMessage(event: MessageEvent) {
        const data = JSON.parse(event.data);

        switch (data.type) {
            case "HELLO":
                this.localId = data.peerId;
                console.log(`[WebRTCMesh] My Peer ID: ${this.localId}`);
                break;
            case "PEER_JOINED":
                console.log(`[WebRTCMesh] Initiating WebRTC to new peer: ${data.peerId}`);
                await this.initiateConnection(data.peerId);
                break;
            case "PEER_LEFT":
                this.closePeer(data.peerId);
                break;
            case "OFFER":
                await this.handleOffer(data.from, data.offer);
                break;
            case "ANSWER":
                await this.handleAnswer(data.from, data.answer);
                break;
            case "ICE":
                await this.handleIceCandidate(data.from, data.candidate);
                break;
        }
    }

    private createPeerConnection(peerId: string): RTCPeerConnection {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.signaling.send(JSON.stringify({ type: "ICE", target: peerId, candidate: event.candidate }));
            }
        };

        pc.ondatachannel = (event) => {
            this.setupDataChannel(peerId, event.channel);
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
                this.closePeer(peerId);
            }
        };

        this.peers.set(peerId, pc);
        return pc;
    }

    private setupDataChannel(peerId: string, channel: RTCDataChannel) {
        this.channels.set(peerId, channel);
        
        channel.onopen = () => console.log(`[WebRTCMesh] Data Channel OPEN with ${peerId}`);
        channel.onclose = () => this.channels.delete(peerId);
        
        channel.onmessage = (event) => {
            // Relay data straight to the Macro-Torus Worker!
            try {
                const packet = JSON.parse(event.data);
                if (packet.type === 'FOREIGN_PLASMID') {
                    this.workerPort.postMessage({ type: 'FOREIGN_PLASMID', payload: packet.payload });
                } else if (packet.type === 'HALO_SYNC') {
                    this.workerPort.postMessage(packet);
                }
            } catch (e) {
                // binary or unrecognized packet
            }
        };
    }

    private async initiateConnection(peerId: string) {
        const pc = this.createPeerConnection(peerId);
        const channel = pc.createDataChannel("omega-64-mesh");
        this.setupDataChannel(peerId, channel);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.signaling.send(JSON.stringify({ type: "OFFER", target: peerId, offer }));
    }

    private async handleOffer(peerId: string, offer: RTCSessionDescriptionInit) {
        let pc = this.peers.get(peerId);
        if (!pc) pc = this.createPeerConnection(peerId);

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.signaling.send(JSON.stringify({ type: "ANSWER", target: peerId, answer }));
    }

    private async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit) {
        const pc = this.peers.get(peerId);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }

    private async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit) {
        const pc = this.peers.get(peerId);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }

    private closePeer(peerId: string) {
        this.channels.get(peerId)?.close();
        this.channels.delete(peerId);
        this.peers.get(peerId)?.close();
        this.peers.delete(peerId);
    }
    
    // Called by the DOM (phase.ts) when the Worker wants to broadcast to the P2P Mesh
    public broadcast(packet: any) {
        const dataStr = JSON.stringify(packet);
        for (const channel of this.channels.values()) {
            if (channel.readyState === "open") {
                channel.send(dataStr);
            }
        }
    }
}
