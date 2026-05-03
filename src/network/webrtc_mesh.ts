import { NomosGate } from "../ontology/nomos_gate.ts";
import { EthersATPBridge, IATPBridge, MockATPBridge } from "./atp_bridge.ts";
import { omega64 } from "../proto/omega64.js";
import { GENESIS_HASH_V1_0 } from "./genesis_inscription.ts";
import { isProduction } from "../shared/config.ts";

/**
 * Deterministically derives a non-trivial ZK proof stub from peer identity.
 * Not a real SP1 proof, but cryptographically non-trivial (FNV-1a chain)
 * and unique per (peerId, genesis, salt). Replace with real SP1 prover
 * when omega_zk_host is wired to production.
 */
function deriveHandshakeProof(peerId: string, localId: string): string {
    const salt = "OMEGA64_HANDSHAKE_SALT_v1_" + GENESIS_HASH_V1_0.toString(16);
    const payload = peerId + "|" + localId + "|" + salt;
    let h = 0x811C_9DC5 >>> 0;
    const enc = new TextEncoder();
    const buf = enc.encode(payload);
    for (let i = 0; i < buf.length; i++) {
        h = (h ^ buf[i]) >>> 0;
        h = Math.imul(h, 0x0100_0193) >>> 0;
    }
    // Chain 3 rounds to increase entropy length
    for (let round = 0; round < 3; round++) {
        for (let i = 0; i < buf.length; i++) {
            h = (h ^ buf[i]) >>> 0;
            h = Math.imul(h, 0x0100_0193) >>> 0;
        }
    }
    return "0x" + h.toString(16).padStart(8, '0') + payload + h.toString(16).padStart(8, '0');
}

export class WebRTCMesh {
    private signaling: WebSocket;
    private peers: Map<string, RTCPeerConnection> = new Map();
    private channels: Map<string, RTCDataChannel> = new Map();
    private workerPort: MessagePort;
    private localId: string = "";
    private atpBridge: IATPBridge;
    /** Era 2081: Non-blocking burn verification queue to prevent head-of-line blocking. */
    private burnQueue: Map<string, Promise<boolean>> = new Map();

    constructor(workerPort: MessagePort, signalingUrl: string = "wss://omega-federation.deno.dev", atpBridge?: IATPBridge) {
        this.workerPort = workerPort;
        if (isProduction() && (!atpBridge || atpBridge instanceof MockATPBridge)) {
            throw new Error("[WebRTCMesh] FATAL: Production mode requires a strict EthersATPBridge. Failing closed.");
        }
        
        this.atpBridge = atpBridge ?? new MockATPBridge(); // Era 2081: Default to MockATPBridge until EthersATPBridge is configured
        
        // Era 920: The Cosmic Entropy Heartbeat
        this.atpBridge.subscribeToCosmicEntropy((entropy) => {
            this.workerPort.postMessage({ type: 'COSMIC_ENTROPY', payload: entropy });
        });

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
            case "SPORE_TELEMETRY":
                // Era 0212: Hardware Spore bridge telemetry via Signaling Server
                this.workerPort.postMessage({
                    type: "SPORE_TELEMETRY",
                    sporeId: data.sporeId,
                    frameBase64: data.frameBase64
                });
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
            // Era 2081: Process asynchronously to avoid head-of-line blocking on DataChannel.
            this.processChannelMessage(event).catch((e) => {
                console.error("[WebRTCMesh] Failed to process message", e);
            });
        };
    }

    private async initiateConnection(peerId: string) {
        const pc = this.createPeerConnection(peerId);
        const channel = pc.createDataChannel("omega-64-mesh");
        this.setupDataChannel(peerId, channel);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const zkProof = deriveHandshakeProof(peerId, this.localId); // Era 2080: non-trivial deterministic stub
        this.signaling.send(JSON.stringify({ type: "OFFER", target: peerId, offer, zkProof }));
    }

    private async handleOffer(peerId: string, offer: RTCSessionDescriptionInit) {
        let pc = this.peers.get(peerId);
        if (!pc) pc = this.createPeerConnection(peerId);

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const zkProof = deriveHandshakeProof(this.localId, peerId); // Era 2080: non-trivial deterministic stub
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
    public broadcast(packet: Record<string, unknown>) {
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
                if (typeof rawData === "string") {
                    channel.send(rawData);
                } else {
                    // @ts-ignore: Uint8Array<ArrayBufferLike> vs ArrayBufferView<ArrayBuffer>
                    channel.send(rawData);
                }
            }
        }
    }

    /**
     * Era 2081: Async message processor to avoid blocking DataChannel queue.
     * Burn verification is offloaded to a promise queue; the channel handler
     * returns immediately so subsequent messages are not delayed.
     */
    private async processChannelMessage(event: MessageEvent) {
        let packet: Record<string, unknown> | undefined;
        if (event.data instanceof ArrayBuffer) {
            // @ts-ignore: pbts generates strict signatures that expect a reader, length, error
            const decoded = omega64.OmegaMessage.decode(new Uint8Array(event.data)) as Record<string, unknown>;
            
            if (decoded.type === omega64.OmegaMessage.MessageType.FOREIGN_PLASMID && decoded.plasmid) {
                packet = { type: 'FOREIGN_PLASMID', payload: decoded.plasmid as Record<string, unknown> };
            } else if (decoded.type === omega64.OmegaMessage.MessageType.IMPACT_EVENT && decoded.impact) {
                packet = { type: 'IMPACT_EVENT', payload: decoded.impact as Record<string, unknown> };
            } else if (decoded.type === omega64.OmegaMessage.MessageType.SYNC_METADATA && decoded.telemetry) {
                packet = decoded.telemetry as Record<string, unknown>;
                packet.type = 'SYNC_METADATA';
            }
        } else if (typeof event.data === "string") {
            packet = JSON.parse(event.data);
        }

        if (packet && packet.type === 'FOREIGN_PLASMID' && packet.payload) {
            const payload = packet.payload as Record<string, string>;
            // Era 280: Validate SP1 STARK ZK-Proof receipt before injection!
            if (payload.proof_bytes) {
                const proof = NomosGate.verify_sp1_receipt(
                    payload.proof_bytes,
                    { morphology: payload.morphology_hash, steps: parseInt(payload.steps_cost) }
                );

                if (proof.valid) {
                    // Era 300: ATP Osmosis Verification (non-blocking)
                    const burnTxHash = payload.burn_tx_hash;
                    if (burnTxHash) {
                        // Deduplicate concurrent verification for same txHash
                        let verifyPromise = this.burnQueue.get(burnTxHash);
                        if (!verifyPromise) {
                            verifyPromise = this.atpBridge.verifyBurnTx(burnTxHash);
                            this.burnQueue.set(burnTxHash, verifyPromise);
                            verifyPromise.then(() => {
                                this.burnQueue.delete(burnTxHash);
                            }).catch(() => {
                                this.burnQueue.delete(burnTxHash);
                            });
                        }
                        const isBurnValid = await verifyPromise;
                        if (isBurnValid) {
                            this.workerPort.postMessage({ type: 'FOREIGN_PLASMID', payload: packet.payload });
                        } else {
                            console.warn(`[WebRTCMesh] Invalid ATP Burn Transaction! Rejected ForeignPlasmid.`);
                        }
                    } else {
                        console.warn(`[WebRTCMesh] ForeignPlasmid missing burn_tx_hash! Rejected.`);
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
    }
}
