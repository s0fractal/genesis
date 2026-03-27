import { OmegaV2Engine } from "../environment/v2_bridge.ts";

/**
 * Era 1020: The Golden Trace
 * Zero-Copy WebRTC Mesh specifically designed for OMEGA-V2.
 * Bypasses V1 ZK-SNARKs and ATP token burns for pure, bare-metal UDP-style pointer syncing.
 */
export class WebRTCV2Mesh {
    private signaling: WebSocket;
    private peers: Map<string, RTCPeerConnection> = new Map();
    private channels: Map<string, RTCDataChannel> = new Map();
    private localId: string = "";
    private engine: OmegaV2Engine;
    
    // Peer slot mapping (We have 4 Intention slots in WASM. Slot 0 is local user)
    private peerSlots: Map<string, number> = new Map();
    private nextSlot = 1;

    constructor(engine: OmegaV2Engine, signalingUrl: string = "wss://omega-federation.deno.dev") {
        this.engine = engine;
        this.signaling = new WebSocket(signalingUrl);

        this.signaling.onmessage = this.handleSignalingMessage.bind(this);
        this.signaling.onopen = () => console.log(`[V2-MESH] Connected to Core Signaling.`);
        this.signaling.onerror = (e) => console.warn(`[V2-MESH] Signaling failed:`, e);
        
        // Start the 30Hz broadcast loop
        setInterval(() => this.broadcastV2State(), 1000 / 30);
    }

    private async handleSignalingMessage(event: MessageEvent) {
        const data = JSON.parse(event.data);

        switch (data.type) {
            case "HELLO":
                this.localId = data.peerId;
                console.log(`[V2-MESH] My Quantum ID: ${this.localId}`);
                break;
            case "PEER_JOINED":
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

        pc.ondatachannel = (event) => this.setupDataChannel(peerId, event.channel);

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
        
        // Assign a slot to the peer (1, 2, or 3)
        if (this.nextSlot < 4) {
            this.peerSlots.set(peerId, this.nextSlot);
            console.log(`[V2-MESH] Peer ${peerId} mapped to WASM Intent Slot ${this.nextSlot}`);
            this.nextSlot++;
        } else {
            console.warn(`[V2-MESH] Max capacity reached. Observer mode for ${peerId}`);
        }
        
        channel.onopen = () => console.log(`[V2-MESH] UDP-Channel OPEN with ${peerId}`);
        channel.onclose = () => {
            this.channels.delete(peerId);
            const slot = this.peerSlots.get(peerId);
            if (slot !== undefined) {
                const setIntent = this.engine.wasm?.exports.v2_set_intent as CallableFunction;
                if (setIntent) setIntent(slot, 0, 0, 0, 0); // Erase their intent from the WebGPU Grid
                this.peerSlots.delete(peerId);
            }
        };
        
        channel.onmessage = (event) => {
            try {
                // Parse lightweight UDP packet
                const packet = JSON.parse(event.data);
                if (packet.t === 'V2_SYNC') {
                    const slot = this.peerSlots.get(peerId);
                    if (slot !== undefined) {
                        const setIntent = this.engine.wasm?.exports.v2_set_intent as CallableFunction;
                        if (setIntent) {
                            if (packet.m > 0) {
                                setIntent(slot, packet.x, packet.y, packet.m, packet.r);
                            } else {
                                setIntent(slot, 0, 0, 0, 0);
                            }
                        }
                    }
                    
                    // Golden Trace Validation
                    const localTrace = (this.engine.wasm?.exports.v2_get_golden_trace as CallableFunction)?.() as number;
                    if (localTrace !== packet.gt) {
                        console.warn(`[V2-MESH] ⚠️ GOLDEN TRACE DIVERGENCE with ${peerId}! (Local: ${localTrace.toString(16)} | Remote: ${packet.gt.toString(16)})`);
                    }
                }
            } catch (e) {
                // Ignore parse errors on UDP layer
            }
        };
    }

    private async initiateConnection(peerId: string) {
        const pc = this.createPeerConnection(peerId);
        // Create an UNRELIABLE, UNORDERED channel for max speed
        const channel = pc.createDataChannel("v2-sync", { ordered: false, maxRetransmits: 0 });
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
        if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    }

    private closePeer(peerId: string) {
        const pc = this.peers.get(peerId);
        if (pc) {
            pc.close();
            this.peers.delete(peerId);
        }
        const channel = this.channels.get(peerId);
        if (channel) {
            channel.close();
            this.channels.delete(peerId);
        }
        
        // Zero out intent
        const slot = this.peerSlots.get(peerId);
        if (slot !== undefined) {
             const setIntent = this.engine.wasm?.exports.v2_set_intent as CallableFunction;
             if (setIntent) setIntent(slot, 0, 0, 0, 0);
             this.peerSlots.delete(peerId);
        }
        console.log(`[V2-MESH] Connection closed: ${peerId}`);
    }
    
    public __lastLocalIntent = { x: 0, y: 0, m: 0, r: 0 };
    
    private broadcastV2State() {
        if (this.channels.size === 0) return;
        
        const getGoldenTrace = this.engine.wasm?.exports.v2_get_golden_trace as CallableFunction;
        const hash = getGoldenTrace ? getGoldenTrace() as number : 0;
        
        const payload = JSON.stringify({
            t: 'V2_SYNC',
            x: this.__lastLocalIntent.x,
            y: this.__lastLocalIntent.y,
            m: this.__lastLocalIntent.m,
            r: this.__lastLocalIntent.r,
            gt: hash
        });
        
        for (const [id, channel] of this.channels.entries()) {
            if (channel.readyState === 'open') {
                channel.send(payload);
            }
        }
    }
}
