import { NomosGate } from "../ontology/nomos_gate.ts";
import { EthersATPBridge, IATPBridge } from "./atp_bridge.ts";
import { omega64 } from "../proto/omega64.js";

export class WebRTCMesh {
    private signaling: WebSocket;
    private peers: Map<string, RTCPeerConnection> = new Map();
    private channels: Map<string, RTCDataChannel> = new Map();
    private workerPort: MessagePort;
    private localId: string = "";
    private atpBridge: IATPBridge;

    constructor(workerPort: MessagePort, signalingUrl: string = "wss://omega-federation.deno.dev") {
        this.workerPort = workerPort;
        this.atpBridge = new EthersATPBridge(); // Era 800: Real Web3 Token Osmosis Bridge
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
                if (!data.zkProof || !NomosGate.verify_sp1_receipt(data.zkProof, { morphology: "handshake", steps: 1 }).valid) {
                    console.warn(`[WebRTCMesh] Rejected peer ${data.from} due to invalid SP1 proof!`);
                    return;
                }
                await this.handleOffer(data.from, data.offer);
                break;
            case "ANSWER":
                if (!data.zkProof || !NomosGate.verify_sp1_receipt(data.zkProof, { morphology: "handshake", steps: 1 }).valid) {
                    console.warn(`[WebRTCMesh] Rejected peer ${data.from} due to invalid SP1 answer proof!`);
                    return;
                }
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
        
        channel.onmessage = async (event) => {
            // Relay data straight to the Macro-Torus Worker!
            try {
                let packet: any;
                if (event.data instanceof ArrayBuffer) {
                    // @ts-ignore: pbts generates strict signatures that expect a reader, length, error
                    const decoded = omega64.OmegaMessage.decode(new Uint8Array(event.data)) as any;
                    
                    if (decoded.type === omega64.OmegaMessage.MessageType.FOREIGN_PLASMID && decoded.plasmid) {
                        packet = { type: 'FOREIGN_PLASMID', payload: decoded.plasmid };
                    } else if (decoded.type === omega64.OmegaMessage.MessageType.IMPACT_EVENT && decoded.impact) {
                        packet = { type: 'IMPACT_EVENT', payload: decoded.impact };
                    } else if (decoded.type === omega64.OmegaMessage.MessageType.SYNC_METADATA && decoded.telemetry) {
                        packet = decoded.telemetry;
                        packet.type = 'SYNC_METADATA';
                    }
                } else if (typeof event.data === "string") {
                    packet = JSON.parse(event.data);
                }

                if (packet && packet.type === 'FOREIGN_PLASMID' && packet.payload) {
                    // Era 280: Validate SP1 STARK ZK-Proof receipt before injection!
                    if (packet.payload.proof_bytes) {
                        const proof = NomosGate.verify_sp1_receipt(
                            packet.payload.proof_bytes,
                            { morphology: packet.payload.morphology_hash, steps: packet.payload.steps_cost }
                        );

                        if (proof.valid) {
                            // Era 300: ATP Osmosis Verification
                            let isBurnValid = false;
                            if (packet.payload.burn_tx_hash) {
                                isBurnValid = await this.atpBridge.verifyBurnTx(packet.payload.burn_tx_hash);
                            }

                            if (isBurnValid) {
                                this.workerPort.postMessage({ type: 'FOREIGN_PLASMID', payload: packet.payload });
                            } else {
                                console.warn(`[WebRTCMesh] Invalid or missing ATP Burn Transaction! Rejected ForeignPlasmid.`);
                            }
                        } else {
                            console.warn(`[WebRTCMesh] STARK Proof invalid! Rejected ForeignPlasmid.`);
                        }
                    } else {
                        console.warn(`[WebRTCMesh] Plasmid packet missing ZK 'proof_bytes'! Rejected.`);
                    }
                } else if (packet && packet.type === 'IMPACT_EVENT') {
                    this.workerPort.postMessage(packet);
                }
            } catch (_e) {
                console.error("[WebRTCMesh] Failed to process message", _e);
            }
        };
    }

    private async initiateConnection(peerId: string) {
        const pc = this.createPeerConnection(peerId);
        const channel = pc.createDataChannel("omega-64-mesh");
        this.setupDataChannel(peerId, channel);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const zkProof = "mock_sp1_handshake_proof_32bytes_min_length"; // Era 280 Scaffolding
        this.signaling.send(JSON.stringify({ type: "OFFER", target: peerId, offer, zkProof }));
    }

    private async handleOffer(peerId: string, offer: RTCSessionDescriptionInit) {
        let pc = this.peers.get(peerId);
        if (!pc) pc = this.createPeerConnection(peerId);

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const zkProof = "mock_sp1_handshake_proof_32bytes_min_length"; // Era 280 Scaffolding
        this.signaling.send(JSON.stringify({ type: "ANSWER", target: peerId, answer, zkProof }));
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
    public broadcast(packet: Record<string, any>) {
        let rawData: Uint8Array | string;
        
        if (packet.type === 'FOREIGN_PLASMID' && packet.payload) {
             const msg = omega64.OmegaMessage.create({
                 type: omega64.OmegaMessage.MessageType.FOREIGN_PLASMID,
                 plasmid: packet.payload
             });
             rawData = omega64.OmegaMessage.encode(msg).finish();
        } else if (packet.type === 'IMPACT_EVENT' && packet.payload) {
             const msg = omega64.OmegaMessage.create({
                 type: omega64.OmegaMessage.MessageType.IMPACT_EVENT,
                 impact: packet.payload
             });
             rawData = omega64.OmegaMessage.encode(msg).finish();
        } else if (packet.type === 'SYNC_METADATA') {
             const msg = omega64.OmegaMessage.create({
                 type: omega64.OmegaMessage.MessageType.SYNC_METADATA,
                 telemetry: packet
             });
             rawData = omega64.OmegaMessage.encode(msg).finish();
        } else {
             rawData = JSON.stringify(packet);
        }

        for (const channel of this.channels.values()) {
            if (channel.readyState === "open") {
                channel.send(rawData as any);
            }
        }
    }
}
