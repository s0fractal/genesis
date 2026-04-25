import { OmegaV2Engine } from "../environment/v2_bridge.ts";
import { PhaseRouter } from "./routing_bridge.ts";

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
    
    private peerSlots: Map<string, number> = new Map();
    private peerAddresses: Map<string, number> = new Map();
    private nextSlot = 1;
    private router: PhaseRouter | null = null;
    private selfAddress: number = 0;

    public isSyncFrozen: boolean = false;
    private overwriteCallback: (snapshot: Uint8Array) => void;

    // Snapshot Reassembly State
    private incomingSnapshot: Uint8Array | null = null;
    private incomingBytesReceived: number = 0;

    constructor(engine: OmegaV2Engine, overwriteCallback: (snapshot: Uint8Array) => void, signalingUrl: string = "wss://omega-federation.deno.dev", router?: PhaseRouter) {
        this.engine = engine;
        this.overwriteCallback = overwriteCallback;
        this.router = router ?? null;
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

        pc.ondatachannel = (event) => {
            if (event.channel.label === "v2-sync") {
                this.setupDataChannel(peerId, event.channel);
            } else if (event.channel.label === "v2-state") {
                this.setupStateChannel(peerId, event.channel);
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
        
        channel.onopen = () => {
            console.log(`[V2-MESH] UDP-Channel OPEN with ${peerId}`);
            // Era 1000: Exchange PhaseAddress on channel open
            this.refreshSelfAddress();
            if (this.selfAddress !== 0) {
                const handshake = JSON.stringify({ t: 'V2_HANDSHAKE', addr: this.selfAddress });
                channel.send(handshake);
            }
        };
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
            if (typeof event.data === 'string') {
                try {
                    // Parse lightweight UDP packet
                    const packet = JSON.parse(event.data);
                    if (packet.t === 'V2_HANDSHAKE') {
                        // Era 1000: Store peer PhaseAddress
                        const addr = packet.addr as number;
                        if (addr !== 0) {
                            this.peerAddresses.set(peerId, addr);
                            console.log(`[V2-MESH] Peer ${peerId} PhaseAddress=${addr}`);
                        }
                        return;
                    }
                    if (packet.t === 'V2_SYNC') {
                        // Era 1000: Passive Phase Routing (Attraction Zone)
                        if (packet.ta !== undefined && this.router && this.selfAddress !== 0) {
                            const hopCount = (packet.hc as number) ?? 0;
                            const maxHops = (packet.mh as number) ?? 8;
                            if (hopCount >= maxHops) {
                                console.log(`[V2-MESH] Plasmid max hops exceeded, dropping.`);
                                return;
                            }
                            const targetAddr = packet.ta as number;
                            const senderAddr = this.peerAddresses.get(peerId) ?? 0;
                            // Use toroidal distance for consensus wrap-around correctness
                            const distSelf = PhaseRouter.hyperbolicDistanceToroidalStatic(this.selfAddress, targetAddr);
                            const distSender = senderAddr !== 0
                                ? PhaseRouter.hyperbolicDistanceToroidalStatic(senderAddr, targetAddr)
                                : Number.MAX_SAFE_INTEGER; // unknown sender -> accept
                            if (distSelf > distSender) {
                                // Self is farther from target than sender -> ignore (let closer node handle it)
                                return;
                            }
                            // Self is closer or equal -> consume this plasmid
                        }

                        const slot = this.peerSlots.get(peerId);
                        if (slot !== undefined) {
                            const setIntent = this.engine.wasm?.exports.v2_set_intent as CallableFunction;
                            if (setIntent) {
                                if (packet.m > 0) {
                                    setIntent(slot, packet.x, packet.y, packet.m, packet.r, packet.g || 0, packet.o || 0);
                                } else {
                                    setIntent(slot, 0, 0, 0, 0, 0, 0);
                                }
                            }
                        }
                        
                        
                        // Golden Trace Validation
                        const localTrace = (this.engine.wasm?.exports.v2_get_golden_trace as CallableFunction)?.() as number;
                        const remoteGt = packet.gt as number;
                        if (localTrace !== remoteGt && !this.isSyncFrozen) {
                            console.warn(`[V2-MESH] ⚠️ GOLDEN TRACE DIVERGENCE! (Local: ${localTrace.toString(16)} | Remote: ${remoteGt.toString(16)})`);
                            // Simplistic tie-breaker for Authority: The higher Hash rules.
                            if (remoteGt > localTrace) {
                                 console.log(`[V2-MESH] Requesting Overmind State Snapshot from Authority...`);
                                 this.isSyncFrozen = true;
                                 const stateChannel = this.getOrOpenStateChannel(peerId);
                                 if (stateChannel?.readyState === 'open') {
                                     stateChannel.send(JSON.stringify({ t: 'REQ_SNAPSHOT' }));
                                 }
                            }
                        }
                    }
                } catch (_e) {
                    // Ignore parse errors on UDP layer
                }
            } else if (event.data instanceof ArrayBuffer) {
                // ERA 6000: Continuous Delta Mutagens
                const ptrs = this.engine.getMemoryPointers();
                if (!ptrs) return;
                
                const deltasU32 = new Uint32Array(event.data);
                const gridU32 = new Uint32Array(ptrs.wasmMemoryBuffer, ptrs.agentBytes.byteOffset, ptrs.agentBytes.byteLength / 4);
                const maxAgents = gridU32.length / 8;
                
                const numMutations = Math.floor(deltasU32.length / 4);
                console.log(`[V2-MESH] 🧬 Applying ${numMutations} Xenobiological Mutations via UDP Delta`);
                
                for (let i = 0; i < numMutations; i++) {
                    const index = deltasU32[i * 4 + 0];
                    const phase = deltasU32[i * 4 + 1];
                    const energy = deltasU32[i * 4 + 2];
                    const genome = deltasU32[i * 4 + 3];
                    
                    // SECURITY: Bounds check against malicious remote index
                    if (index >= maxAgents) {
                        console.warn(`[V2-MESH] ⚠️ Delta index ${index} out of bounds (max ${maxAgents}), dropping mutation.`);
                        continue;
                    }
                    
                    // Update 32-byte PhaseAgentMinimal (8x u32s)
                    gridU32[index * 8 + 0] = phase;
                    gridU32[index * 8 + 1] = energy;
                    gridU32[index * 8 + 4] = genome;
                }
            }
        };
    }

    private stateChannels: Map<string, RTCDataChannel> = new Map();

    private getOrOpenStateChannel(peerId: string): RTCDataChannel | undefined {
        let sc = this.stateChannels.get(peerId);
        if (!sc) {
            const pc = this.peers.get(peerId);
            if (pc) {
                sc = pc.createDataChannel("v2-state", { ordered: true });
                sc.binaryType = "arraybuffer";
                this.setupStateChannel(peerId, sc);
            }
        }
        return sc;
    }

    private setupStateChannel(peerId: string, channel: RTCDataChannel) {
        this.stateChannels.set(peerId, channel);
        channel.binaryType = "arraybuffer";
        channel.onopen = () => console.log(`[V2-STATE] TCP-Style State Channel OPEN with ${peerId}`);
        channel.onmessage = (event) => {
            if (typeof event.data === 'string') {
                const msg = JSON.parse(event.data);
                if (msg.t === 'REQ_SNAPSHOT') {
                    if (this.latestSnapshot) {
                        console.log(`[V2-STATE] Sending 32MB Snapshot to ${peerId}...`);
                        channel.send(JSON.stringify({ t: 'SNAPSHOT_HEADER', size: this.latestSnapshot.byteLength }));
                        
                        // Blast 64KB chunks
                        const CHUNK_SIZE = 64000;
                        for (let i = 0; i < this.latestSnapshot.byteLength; i += CHUNK_SIZE) {
                            const chunk = this.latestSnapshot.slice(i, i + CHUNK_SIZE);
                            channel.send(chunk);
                        }
                    }
                } else if (msg.t === 'SNAPSHOT_HEADER') {
                    console.log(`[V2-STATE] Incoming 32MB Snapshot (${msg.size} bytes)...`);
                    this.incomingSnapshot = new Uint8Array(msg.size);
                    this.incomingBytesReceived = 0;
                    this.isSyncFrozen = true;
                }
            } else if (event.data instanceof ArrayBuffer) {
                if (this.incomingSnapshot) {
                    const chunk = new Uint8Array(event.data);
                    this.incomingSnapshot.set(chunk, this.incomingBytesReceived);
                    this.incomingBytesReceived += chunk.byteLength;
                    
                    if (this.incomingBytesReceived >= this.incomingSnapshot.byteLength) {
                        console.log(`[V2-STATE] Snapshot Assembly Complete! Injecting to GPU Memory.`);
                        this.overwriteCallback(this.incomingSnapshot);
                        this.incomingSnapshot = null;
                        this.isSyncFrozen = false;
                    }
                }
            }
        };
    }

    private async initiateConnection(peerId: string) {
        const pc = this.createPeerConnection(peerId);
        // Create an UNRELIABLE, UNORDERED channel for max speed intentions
        const channel = pc.createDataChannel("v2-sync", { ordered: false, maxRetransmits: 0 });
        // ER-6000: Set DataChannel explicitly to accept raw ArrayBuffers to decode Deltas instantly
        channel.binaryType = "arraybuffer";
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

    private refreshSelfAddress() {
        if (!this.router || !this.engine.wasm) return;
        this.selfAddress = this.router.addressFromAgent(0);
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
             if (setIntent) setIntent(slot, 0, 0, 0, 0, 0, 0);
             this.peerSlots.delete(peerId);
        }
        this.peerAddresses.delete(peerId);
        console.log(`[V2-MESH] Connection closed: ${peerId}`);
    }
    
    public __lastLocalIntent = { x: 0, y: 0, m: 0, r: 0, g: 0, op: 0 };
    private latestGoldenTraceNum: number = 0;
    private latestSnapshot: Uint8Array | null = null;
    
    public setLatestState(gt: number, snapshot: Uint8Array) {
        this.latestGoldenTraceNum = gt;
        this.latestSnapshot = snapshot;
    }
    
    private broadcastV2State() {
        if (this.channels.size === 0) return;

        this.refreshSelfAddress();
        
        const payload = JSON.stringify({
            t: 'V2_SYNC',
            x: this.__lastLocalIntent.x,
            y: this.__lastLocalIntent.y,
            m: this.__lastLocalIntent.m,
            r: this.__lastLocalIntent.r,
            g: this.__lastLocalIntent.g,
            o: this.__lastLocalIntent.op,
            gt: this.latestGoldenTraceNum,
            // Era 1000: Phase Routing fields
            ta: this.selfAddress,
            hc: 0,
            mh: 8,
        });
        
        let deltaBuffer: ArrayBuffer | null = null;
        if (this.engine.wasm?.exports.v2_generate_delta_snapshot) {
            const numMutations = (this.engine.wasm.exports.v2_generate_delta_snapshot as CallableFunction)();
            if (numMutations > 0 && numMutations <= 6400) {
                 const ptrs = this.engine.getMemoryPointers();
                 if (ptrs) {
                     // Slice the exact mutation bytes for transport (zero-garbage networking)
                     deltaBuffer = ptrs.deltaBufferBytes.slice(0, numMutations * 16).buffer;
                 }
            }
        }
        
        for (const [_id, channel] of this.channels.entries()) {
            if (channel.readyState === 'open') {
                channel.send(payload);
                if (deltaBuffer) {
                    channel.send(deltaBuffer);
                }
            }
        }
    }
}
