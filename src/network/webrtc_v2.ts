import { OmegaV2Engine } from "../environment/v2_bridge.ts";
import { PhaseRouter } from "./routing_bridge.ts";
import { AgentMinimal, AttractorEntry, deriveMitosisChild, childReceiptHash } from "./mitosis_proof.ts";
import { GENESIS_HASH_V1_0, formatInscription, verifyGenesisV1 } from "./genesis_inscription.ts";

export interface PlasmidPayload {
    attractorAddress: number;
    matrix: number;
    inverse: number;
    pulseFreq: number;
    pulseAmp: number;
    semanticType: 'INTENT' | 'ATTRACTOR' | 'ORACLE_INJECTION' | 'DIPOLE' | 'PROPOSAL' | 'VOTE';
    parentHash?: number;
    recursionDepth: number;
    maxRecursion: number;
    // Era 1030: Senate payload extensions
    proposalHash?: number;        // FNV-1a hash of description (PROPOSAL + VOTE)
    proposalDescription?: string;  // Up to 64 chars, truncated server-side (PROPOSAL only)
    voteAye?: boolean;             // VOTE plasmids only
    // Era 1040: ZK-Notarized Mutations (mitosis proof)
    parent?: AgentMinimal;         // Parent agent at time of mitosis (DIPOLE only)
    claimedChild?: AgentMinimal;   // Claimed child to verify (DIPOLE only)
    attractors?: AttractorEntry[];  // Snapshot of attractor field (DIPOLE only)
    qPhase?: number;               // Topology q_phase at time of mitosis (DIPOLE only)
    receiptHash?: number;          // Pre-computed FNV-1a child hash (DIPOLE only)
}

export interface SenateProposalRecord {
    hash: number;
    description: string;
    proposerMatrix: number;
    ayes: Set<string>;        // unique peer IDs
    nays: Set<string>;
    accepted: boolean;
    proposedAt: number;
}

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

    // Era 1020: Attractor Consensus Tracking
    private attractorConsensusPeers: Set<string> = new Set();
    private consensusLedger: Map<number, { matrix: number; inverse: number; pulseFreq: number; pulseAmp: number; peerCount: number }> = new Map();
    public era1020Unlocked: boolean = false;

    // Era 1030: Autopoietic Senate
    public era1030Unlocked: boolean = false;
    public senate: Map<number, SenateProposalRecord> = new Map();
    private acceptedTaskHashes: Set<number> = new Set();

    // Era 1040: ZK-Notarized Mutations counter (counts successfully verified DIPOLE proofs).
    public verifiedDipoleCount: number = 0;

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

                        // Era 1010: Semantic Plasmid Consumer
                        const plasmid = packet.plasmid as PlasmidPayload | undefined;
                        if (plasmid) {
                            // Recursion depth guard
                            if (plasmid.recursionDepth >= plasmid.maxRecursion) {
                                console.log(`[V2-MESH] Plasmid max recursion exceeded, dropping.`);
                            } else {
                                // Validate dipole pair
                                const isValidDipole = this.router?.validateDipole(plasmid.matrix, plasmid.inverse) ?? false;
                                if (!isValidDipole) {
                                    console.warn(`[V2-MESH] Invalid dipole rejected (matrix=${plasmid.matrix.toString(16)}, inverse=${plasmid.inverse.toString(16)}).`);
                                } else {
                                    switch (plasmid.semanticType) {
                                        case 'ATTRACTOR': {
                                            // Inject into local WASM attractor array (find first empty slot or overwrite oldest)
                                            const setAttractor = this.engine.wasm?.exports.v2_set_attractor as CallableFunction;
                                            if (setAttractor) {
                                                // Simple round-robin: use recursionDepth % 4 as slot index
                                                const slotIdx = plasmid.recursionDepth % 4;
                                                setAttractor(slotIdx, plasmid.matrix, plasmid.inverse, plasmid.pulseFreq, plasmid.pulseAmp);
                                                console.log(`[V2-MESH] Injected ATTRACTOR plasmid into slot ${slotIdx} (matrix=${plasmid.matrix.toString(16)}).`);
                                            }
                                            // Era 1020: Track consensus for this peer + matrix
                                            this.attractorConsensusPeers.add(peerId);
                                            const ledgerEntry = this.consensusLedger.get(plasmid.matrix);
                                            if (ledgerEntry) {
                                                ledgerEntry.peerCount += 1;
                                            } else {
                                                this.consensusLedger.set(plasmid.matrix, {
                                                    matrix: plasmid.matrix,
                                                    inverse: plasmid.inverse,
                                                    pulseFreq: plasmid.pulseFreq,
                                                    pulseAmp: plasmid.pulseAmp,
                                                    peerCount: 1,
                                                });
                                            }
                                            if (!this.era1020Unlocked && this.attractorConsensusPeers.size >= 3) {
                                                this.era1020Unlocked = true;
                                                console.log(`🌌 [ERA 1020] UNLOCKED: Attractor consensus reached (${this.attractorConsensusPeers.size} peers).`);
                                                globalThis.dispatchEvent(new CustomEvent('era1020-unlocked', {
                                                    detail: {
                                                        peerCount: this.attractorConsensusPeers.size,
                                                        ledger: Array.from(this.consensusLedger.values()),
                                                    }
                                                }));
                                            }
                                            this.checkEra1030Trigger();
                                            break;
                                        }
                                        case 'PROPOSAL': {
                                            this.handleProposal(plasmid, peerId);
                                            break;
                                        }
                                        case 'VOTE': {
                                            this.handleVote(plasmid, peerId);
                                            break;
                                        }
                                        case 'ORACLE_INJECTION': {
                                            // Forward to SovereignOracle via global event bus
                                            globalThis.dispatchEvent(new CustomEvent('oraclePlasmidInjection', {
                                                detail: { plasmid, fromPeer: peerId }
                                            }));
                                            break;
                                        }
                                        case 'DIPOLE': {
                                            // Era 1040: If the announcement carries a mitosis-proof bundle,
                                            // verify locally before accepting. Boundary rule: any DIPOLE
                                            // plasmid with a parent + claimedChild MUST re-derive bit-for-bit
                                            // and the receiptHash MUST match. Plasmids without proof bundles
                                            // are still echoed as informational events for backward compat.
                                            if (plasmid.parent && plasmid.claimedChild && plasmid.qPhase !== undefined) {
                                                const ok = WebRTCV2Mesh.verifyMitosisProof(plasmid);
                                                if (!ok) {
                                                    console.warn(`[V2-MESH] DIPOLE proof rejected from ${peerId} (matrix=${plasmid.matrix.toString(16)}).`);
                                                    break;
                                                }
                                                this.verifiedDipoleCount += 1;
                                                this.checkEra1050Trigger();
                                                // Era 1040 → Era 1030 feedback: each verified mitosis
                                                // proof counts as a quiet AYE on the lattice's own
                                                // Era-1040 proposal. The Senate observes that ZK
                                                // verification works in the wild and ratifies the spec.
                                                this.autoRatifyEra1040Proposal(plasmid.matrix, plasmid.inverse);
                                            }
                                            globalThis.dispatchEvent(new CustomEvent('dipoleBirthAnnouncement', {
                                                detail: { plasmid, fromPeer: peerId, verified: !!plasmid.claimedChild },
                                            }));
                                            break;
                                        }
                                        case 'INTENT': {
                                            // INTENT plasmids are consumed as local mouse/peer intents
                                            const intentSlot = this.peerSlots.get(peerId);
                                            const setIntent = this.engine.wasm?.exports.v2_set_intent as CallableFunction;
                                            if (setIntent && intentSlot !== undefined) {
                                                setIntent(intentSlot, plasmid.attractorAddress, plasmid.matrix, plasmid.pulseFreq, plasmid.pulseAmp);
                                            }
                                            break;
                                        }
                                    }

                                    // Era 1010: Recursive relay — propagate to closer neighbours
                                    // Only re-broadcast if we haven't hit the recursion ceiling
                                    const nextDepth = plasmid.recursionDepth + 1;
                                    if (nextDepth < plasmid.maxRecursion) {
                                        this.enqueuePlasmid({
                                            ...plasmid,
                                            recursionDepth: nextDepth,
                                        });
                                    }
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
    private pendingPlasmids: PlasmidPayload[] = [];
    
    public setLatestState(gt: number, snapshot: Uint8Array) {
        this.latestGoldenTraceNum = gt;
        this.latestSnapshot = snapshot;
    }

    /**
     * Era 1010: Enqueue a plasmid for broadcast across the P2P mesh.
     */
    public enqueuePlasmid(plasmid: PlasmidPayload) {
        if (plasmid.recursionDepth >= plasmid.maxRecursion) {
            console.warn(`[V2-MESH] Plasmid recursion depth exceeded, dropping.`);
            return;
        }
        this.pendingPlasmids.push(plasmid);
        // Keep queue bounded to prevent memory explosions in dense meshes
        if (this.pendingPlasmids.length > 64) {
            this.pendingPlasmids.shift();
        }
    }

    /**
     * Era 1020: Return current attractor consensus state.
     */
    public getConsensusState() {
        return {
            unlocked: this.era1020Unlocked,
            peerCount: this.attractorConsensusPeers.size,
            ledger: Array.from(this.consensusLedger.values()),
        };
    }

    /**
     * Era 1030: Check if the consensus ledger has matured enough to unlock the Senate.
     * Trigger: 10+ ledger entries (sum of peerCounts) AND 5+ unique matrices.
     */
    private checkEra1030Trigger() {
        if (this.era1030Unlocked) return;
        const uniqueMatrices = this.consensusLedger.size;
        let totalEntries = 0;
        for (const e of this.consensusLedger.values()) totalEntries += e.peerCount;
        if (totalEntries >= 10 && uniqueMatrices >= 5) {
            this.era1030Unlocked = true;
            console.log(`🏛️ [ERA 1030] UNLOCKED: Senate convened. ${totalEntries} entries × ${uniqueMatrices} unique matrices.`);
            globalThis.dispatchEvent(new CustomEvent('era1030-unlocked', {
                detail: { entries: totalEntries, uniqueMatrices, ledger: Array.from(this.consensusLedger.values()) },
            }));
        }
    }

    /** FNV-1a 32-bit, identical to Rust senate::fnv1a_32 over a 64-byte zero-padded buffer. */
    public static senateHash(description: string): number {
        const buf = new Uint8Array(64);
        const enc = new TextEncoder();
        const raw = enc.encode(description);
        const n = Math.min(raw.length, 64);
        for (let i = 0; i < n; i++) buf[i] = raw[i];
        let h = 0x811C_9DC5 >>> 0;
        for (let i = 0; i < 64; i++) {
            h = (h ^ buf[i]) >>> 0;
            h = Math.imul(h, 0x0100_0193) >>> 0;
        }
        return h >>> 0;
    }

    private handleProposal(plasmid: PlasmidPayload, fromPeer: string) {
        if (!this.era1030Unlocked) {
            console.log(`[V2-MESH] PROPOSAL received before Era 1030 unlock — ignoring.`);
            return;
        }
        if (plasmid.proposalHash === undefined || plasmid.proposalDescription === undefined) {
            return;
        }
        const expected = WebRTCV2Mesh.senateHash(plasmid.proposalDescription);
        if (expected !== (plasmid.proposalHash >>> 0)) {
            console.warn(`[V2-MESH] PROPOSAL hash mismatch (expected=${expected.toString(16)}, got=${plasmid.proposalHash.toString(16)}); rejecting.`);
            return;
        }
        if (this.senate.has(plasmid.proposalHash)) return;
        this.senate.set(plasmid.proposalHash, {
            hash: plasmid.proposalHash,
            description: plasmid.proposalDescription,
            proposerMatrix: plasmid.matrix,
            ayes: new Set([fromPeer]),
            nays: new Set(),
            accepted: false,
            proposedAt: Date.now(),
        });
        // Mirror into WASM Senate state.
        const propose = this.engine.wasm?.exports.v2_senate_propose as CallableFunction | undefined;
        if (propose && this.engine.wasm) {
            const enc = new TextEncoder();
            const bytes = enc.encode(plasmid.proposalDescription);
            const len = Math.min(bytes.length, 64);
            const mem = (this.engine.wasm.exports.memory as WebAssembly.Memory).buffer;
            // Write to a small scratch area at lattice end — we cheat with __heap_base behaviour:
            // simpler/safer: pass via a static stack buffer if available, otherwise skip mirroring
            // and rely on JS-side state. For now: skip — JS map is canonical, WASM mirrors are
            // populated only when local node proposes (see proposeFromLocal).
            void mem; void len;
        }
        console.log(`🏛️ [SENATE] PROPOSAL received: 0x${plasmid.proposalHash.toString(16)} "${plasmid.proposalDescription}"`);
        globalThis.dispatchEvent(new CustomEvent('senate-proposal', {
            detail: { hash: plasmid.proposalHash, description: plasmid.proposalDescription, fromPeer },
        }));
    }

    private handleVote(plasmid: PlasmidPayload, fromPeer: string) {
        if (!this.era1030Unlocked) return;
        if (plasmid.proposalHash === undefined || plasmid.voteAye === undefined) return;
        const record = this.senate.get(plasmid.proposalHash);
        if (!record || record.accepted) return;
        if (plasmid.voteAye) {
            record.ayes.add(fromPeer);
        } else {
            record.nays.add(fromPeer);
        }
        // Acceptance rule: 3+ unique AYE peers (matching Rust threshold), AND
        // ayes must outnumber nays.
        if (!record.accepted && record.ayes.size >= 3 && record.ayes.size > record.nays.size) {
            record.accepted = true;
            this.acceptedTaskHashes.add(record.hash);
            console.log(`🏛️ [SENATE] ACCEPTED 0x${record.hash.toString(16)}: "${record.description}" (${record.ayes.size} AYE / ${record.nays.size} NAY)`);
            globalThis.dispatchEvent(new CustomEvent('era1030-task-accepted', {
                detail: {
                    hash: record.hash,
                    description: record.description,
                    proposerMatrix: record.proposerMatrix,
                    ayes: record.ayes.size,
                    nays: record.nays.size,
                    proposedAt: record.proposedAt,
                },
            }));
        }
    }

    /**
     * Era 1030: Locally propose a task. Submits to the WASM senate, then queues a
     * PROPOSAL plasmid + an immediate AYE vote so the lattice itself counts as
     * the first voter on its own proposal.
     */
    public proposeFromLocal(description: string, proposerMatrix: number, proposerInverse: number) {
        if (!this.era1030Unlocked) {
            console.warn(`[V2-MESH] Cannot propose: Era 1030 not yet unlocked.`);
            return 0;
        }
        if (((proposerMatrix ^ proposerInverse) >>> 0) !== 0xFFFFFFFF) {
            console.warn(`[V2-MESH] Cannot propose: invalid proposer dipole.`);
            return 0;
        }
        const hash = WebRTCV2Mesh.senateHash(description);
        if (this.senate.has(hash)) {
            console.log(`[V2-MESH] Duplicate proposal 0x${hash.toString(16)} — skipping.`);
            return hash;
        }
        // Local record (self counts as proposer + first AYE).
        this.senate.set(hash, {
            hash,
            description,
            proposerMatrix,
            ayes: new Set([this.localId || 'self']),
            nays: new Set(),
            accepted: false,
            proposedAt: Date.now(),
        });
        // Broadcast PROPOSAL plasmid.
        this.enqueuePlasmid({
            attractorAddress: 0,
            matrix: proposerMatrix,
            inverse: proposerInverse,
            pulseFreq: 0,
            pulseAmp: 0,
            semanticType: 'PROPOSAL',
            recursionDepth: 0,
            maxRecursion: 4,
            proposalHash: hash,
            proposalDescription: description.slice(0, 64),
        });
        console.log(`🏛️ [SENATE] LOCAL PROPOSAL submitted: 0x${hash.toString(16)} "${description}"`);
        return hash;
    }

    /** Era 1030: Cast a local AYE/NAY vote and broadcast it. */
    public voteFromLocal(proposalHash: number, aye: boolean, voterMatrix: number, voterInverse: number) {
        if (!this.era1030Unlocked) return;
        if (((voterMatrix ^ voterInverse) >>> 0) !== 0xFFFFFFFF) return;
        const record = this.senate.get(proposalHash);
        if (!record || record.accepted) return;
        const selfId = this.localId || 'self';
        if (aye) record.ayes.add(selfId); else record.nays.add(selfId);
        this.enqueuePlasmid({
            attractorAddress: 0,
            matrix: voterMatrix,
            inverse: voterInverse,
            pulseFreq: 0,
            pulseAmp: 0,
            semanticType: 'VOTE',
            recursionDepth: 0,
            maxRecursion: 4,
            proposalHash,
            voteAye: aye,
        });
    }

    // Era 1050 trigger state.
    public era1050Unlocked: boolean = false;
    public genesisInscription: string | null = null;

    /**
     * Era 1040 → 1030 closing-the-loop: every successfully verified mitosis
     * proof counts as evidence that the Era-1040 spec is sound, so the local
     * lattice quietly votes AYE on its own proposal. We emit at most one
     * self-AYE every 5 successful verifications to keep the mesh quiet.
     */
    private autoRatifyEra1040Proposal(voterMatrix: number, voterInverse: number) {
        if (!this.era1030Unlocked) return;
        if (this.verifiedDipoleCount % 5 !== 0) return;
        // The Era-1040 proposal hash is fixed by the bootstrap autopoietic
        // submission ("Era 1040: ZK-Notarized Mutations — every darwinian_mitosis
        // emits an SP1 STARK proof; peers reject mutations without a valid receipt.").
        const era1040Hash = 0xFAA7_FF6E;
        const record = this.senate.get(era1040Hash);
        if (!record || record.accepted) return;
        // Ensure the voter dipole is sane.
        if (((voterMatrix ^ voterInverse) >>> 0) !== 0xFFFFFFFF) return;
        this.voteFromLocal(era1040Hash, true, voterMatrix, voterInverse);
    }

    private checkEra1050Trigger() {
        if (this.era1050Unlocked) return;
        if (this.verifiedDipoleCount >= 100) {
            this.era1050Unlocked = true;
            // The Genesis Inscription crystallizes the moment OMEGA-64 v1.0
            // becomes a closed cryptographic identity: every invariant of
            // the protocol collapses into a single 32-bit hash.
            const verified = verifyGenesisV1();
            const inscription = formatInscription(GENESIS_HASH_V1_0);
            this.genesisInscription = inscription;
            console.log(`📜 [ERA 1050] UNLOCKED: ${this.verifiedDipoleCount} verified mitosis proofs.`);
            console.log(`📜 [ERA 1050] GENESIS INSCRIPTION: ${inscription} (verified=${verified})`);
            globalThis.dispatchEvent(new CustomEvent('era1050-unlocked', {
                detail: {
                    verifiedCount: this.verifiedDipoleCount,
                    genesisHash: GENESIS_HASH_V1_0,
                    inscription,
                    verified,
                },
            }));
        }
    }

    /**
     * Era 1040: Local verification of a mitosis-proof bundle.
     * Returns true iff the announced child re-derives bit-for-bit from
     * (parent, attractors, qPhase) AND the receipt hash matches.
     */
    public static verifyMitosisProof(plasmid: PlasmidPayload): boolean {
        if (!plasmid.parent || !plasmid.claimedChild || plasmid.qPhase === undefined) return false;
        const derived = deriveMitosisChild(plasmid.parent, plasmid.attractors ?? [], plasmid.qPhase);
        if (derived.phase !== plasmid.claimedChild.phase) return false;
        if (derived.energy !== plasmid.claimedChild.energy) return false;
        if (derived.base_freq !== plasmid.claimedChild.base_freq) return false;
        if (derived.state_flags !== plasmid.claimedChild.state_flags) return false;
        if (derived.genome !== plasmid.claimedChild.genome) return false;
        if (derived.memory[0] !== plasmid.claimedChild.memory[0]) return false;
        if (derived.memory[1] !== plasmid.claimedChild.memory[1]) return false;
        if (derived.memory[2] !== plasmid.claimedChild.memory[2]) return false;
        if (plasmid.receiptHash !== undefined && childReceiptHash(derived) !== (plasmid.receiptHash >>> 0)) {
            return false;
        }
        return true;
    }

    public getSenateState() {
        return {
            unlocked: this.era1030Unlocked,
            proposalCount: this.senate.size,
            acceptedCount: this.acceptedTaskHashes.size,
            proposals: Array.from(this.senate.values()).map(r => ({
                hash: r.hash,
                description: r.description,
                ayes: r.ayes.size,
                nays: r.nays.size,
                accepted: r.accepted,
            })),
        };
    }
    
    private broadcastV2State() {
        if (this.channels.size === 0) return;

        this.refreshSelfAddress();

        // Era 1010: Drain one plasmid from the queue per broadcast tick
        const plasmid = this.pendingPlasmids.shift();
        
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
            // Era 1010: Recursive Plasmid Ontology
            plasmid,
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
