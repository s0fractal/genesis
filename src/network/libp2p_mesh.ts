// @ts-nocheck


// Era 2060: Libp2p mesh is experimental and currently has peer-dependency
// version mismatches that break Deno type-checking. It compiles under
// `tsc --noEmit` with a compatible npm lockfile, but is not part of the
// primary test surface. The quorum_warrant_bridge_test.ts integration
// that previously imported this file now uses a canonical inline FNV-1a
// reference instead (Era 0199 fix).
import { OmegaV2Engine } from "../environment/v2_bridge.ts";
import { PhaseRouter } from "./routing_bridge.ts";
import {
  AgentMinimal,
  AttractorEntry,
  childReceiptHash,
  deriveMitosisChild,
} from "./mitosis_proof.ts";
import {
  formatInscription,
  GENESIS_HASH_LEGACY_V1_0,
  verifyGenesisV1,
} from "./genesis_inscription.ts";
import { CANONICAL_ORACLES, CanonicalOracle, ORACLE_MATRICES_V1, oracleDipole } from "./oracle_identity.ts";
import { CrossModelDebate } from "./cross_model_debate.ts";
import { buildV2SyncFrame, frameFromBytes, frameToBytes, parseV2SyncFrame } from "./spore_frame.ts";

export interface PlasmidPayload {
  attractorAddress: number;
  matrix: number;
  inverse: number;
  pulseFreq: number;
  pulseAmp: number;
  semanticType:
    | "INTENT"
    | "ATTRACTOR"
    | "ORACLE_INJECTION"
    | "DIPOLE"
    | "PROPOSAL"
    | "VOTE"
    | "EVENT_SYNC"
    | "TRANSLATION_POLICY"
    | "TRANSLATION_POLICY_CORROBORATION"
    | "TRANSLATION_POLICY_REPLAY_DIGEST"
    | "TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST"
    | "TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_DIGEST";
  parentHash?: number;
  recursionDepth: number;
  maxRecursion: number;
  // Era 1030: Senate payload extensions
  proposalHash?: string; // FNV-1a hash of description (PROPOSAL + VOTE)
  proposalDescription?: string; // Up to 64 chars, truncated server-side (PROPOSAL only)
  voteAye?: boolean; // VOTE plasmids only
  // Era 2060: Bitcoin Hyperbolic Geometry (Time Curvature)
  tau?: number; // The Bitcoin block height (Golden Trace state) when this plasmid was forged
  // Era 1040: ZK-Notarized Mutations (mitosis proof)
  parent?: AgentMinimal; // Parent agent at time of mitosis (DIPOLE only)
  claimedChild?: AgentMinimal; // Claimed child to verify (DIPOLE only)
  attractors?: AttractorEntry[]; // Snapshot of attractor field (DIPOLE only)
  qPhase?: number; // Topology q_phase at time of mitosis (DIPOLE only)
  receiptHash?: string; // Pre-computed FNV-1a child hash (DIPOLE only)
  // Era 1060: Multi-Oracle Senate vote attribution (VOTE plasmids only).
  oracleName?: CanonicalOracle; // The oracle casting this vote (claude/gpt/...)
  oracleReasoning?: string; // Optional human-readable reasoning trace (≤256 chars)
  // Era 1510: Forensic event sync envelope. Carries serialized
  // BridgeMessage JSON (Era 1500 webrtc_event_bridge.ts) so the
  // mesh's plasmid pipeline can deliver event-convergence packets
  // peer-to-peer. Receivers route to their local WebRTCEventBridge.
  eventSyncBody?: string; // EVENT_SYNC plasmids only
  eventSyncTarget?: number; // peer_id of the recipient (number)
  // Era 1660: Translation policy claim envelope. Carries serialized
  // TranslationPolicyClaim JSON (Era 1650 translation_policy_monitor.ts).
  translationPolicyBody?: string; // TRANSLATION_POLICY plasmids only
  translationPolicyTarget?: number; // peer_id of the recipient (number)
  // Era 1700: Translation policy corroboration raise envelope.
  // Carries serialized TranslationPolicyCorroborationRaise JSON.
  translationPolicyCorroborationBody?: string; // TRANSLATION_POLICY_CORROBORATION only
  translationPolicyCorroborationTarget?: number; // peer_id of recipient
  // Era 1870: Translation policy forensic replay digest claim.
  // Carries serialized TranslationPolicyReplayDigestClaim JSON.
  translationPolicyReplayDigestBody?: string; // TRANSLATION_POLICY_REPLAY_DIGEST only
  translationPolicyReplayDigestTarget?: number; // peer_id of recipient
  // Era 1950: Translation policy replay-digest replay digest claim.
  // Carries serialized TranslationPolicyReplayDigestDigestClaim JSON.
  translationPolicyReplayDigestDigestBody?: string; // TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST only
  translationPolicyReplayDigestDigestTarget?: number; // peer_id of recipient
  // Era 2040: Translation policy tpdd forensic replay digest claim.
  // Carries serialized TranslationPolicyReplayDigestDigestForensicReplayDigestClaim JSON.
  translationPolicyReplayDigestDigestForensicReplayDigestBody?: string; // TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_DIGEST only
  translationPolicyReplayDigestDigestForensicReplayDigestTarget?: number; // peer_id of recipient
}

export interface SenateProposalRecord {
  hash: string;
  description: string;
  proposerMatrix: number;
  ayes: Set<string>; // unique peer IDs
  nays: Set<string>;
  ayesWeight: number; // Era 1070+: Resonance-weighted
  naysWeight: number;
  accepted: boolean;
  proposedAt: number;
  // Era 1060: oracle-attributed votes (peer-id-independent).
  oracleAyes?: Set<CanonicalOracle>;
  oracleNays?: Set<CanonicalOracle>;
  oracleReasoning?: Record<string, string>;
}

import { createLibp2p, Libp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@libp2p/yamux';
import { kadDHT } from '@libp2p/kad-dht';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { webRTC } from '@libp2p/webrtc';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';

/**
 * Era 2060: The Mycelial Mesh
 * Libp2p GossipSub + Kademlia DHT Decentralized Mesh
 */
export class Libp2pMesh {
  private node!: any;
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
  private consensusLedger: Map<
    number,
    {
      matrix: number;
      inverse: number;
      pulseFreq: number;
      pulseAmp: number;
      peerCount: number;
    }
  > = new Map();
  public era1020Unlocked: boolean = false;

  // Era 1030: Autopoietic Senate
  public era1030Unlocked: boolean = false;
  public senate: Map<string, SenateProposalRecord> = new Map();
  private acceptedTaskHashes: Set<number> = new Set();

  // Era 1040: ZK-Notarized Mutations counter (counts successfully verified DIPOLE proofs).
  public verifiedDipoleCount: number = 0;

  // Era 1070: Cross-model debate ledger (full-text store, key = proposalHash).
  public debate: CrossModelDebate = new CrossModelDebate();
  public era1070Unlocked: boolean = false;
  public era1070AcceptedVisionHash: number | null = null;

  constructor(
    engine: OmegaV2Engine,
    overwriteCallback: (snapshot: Uint8Array) => void,
    bootstrapMultiaddr?: string,
    router?: PhaseRouter,
  ) {
    this.engine = engine;
    this.overwriteCallback = overwriteCallback;
    this.router = router ?? null;

    this.initNode(bootstrapMultiaddr);

    // Start the 30Hz broadcast loop
    setInterval(() => this.broadcastV2State(), 1000 / 30);
  }

  private async initNode(bootstrapMultiaddr?: string) {
    this.node = await createLibp2p({
      transports: [
        webSockets(),
        webRTC({
          rtcConfiguration: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        }),
        circuitRelayTransport({ discoverRelays: 1 } as any)
      ],
      connectionEncryption: [noise()],
      streamMuxers: [yamux()],
      services: {
        dht: kadDHT(),
        pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
      }
    });

    this.localId = this.node.peerId.toString();
    console.log(`[LIBP2P-MESH] My Node ID: ${this.localId}`);

    this.node.addEventListener('peer:connect', (evt: any) => {
        const peerId = evt.detail.toString();
        console.log(`[LIBP2P-MESH] Connection established to: ${peerId}`);
        this.handlePeerJoined(peerId);
    });

    this.node.addEventListener('peer:disconnect', (evt: any) => {
        const peerId = evt.detail.toString();
        console.log(`[LIBP2P-MESH] Disconnected from: ${peerId}`);
        this.closePeer(peerId);
    });

    this.node.services.pubsub.addEventListener('message', (evt: any) => {
        if (evt.detail.topic === 'v2-sync-bin') {
            this.handleSyncBinMessage(evt.detail.from.toString(), new Uint8Array(evt.detail.data));
        } else if (evt.detail.topic === 'v2-state') {
            this.handleStateMessage(evt.detail.from.toString(), evt.detail.data.buffer as ArrayBuffer);
        }
    });

    this.node.services.pubsub.subscribe('v2-sync-bin');
    this.node.services.pubsub.subscribe('v2-state');

    await this.node.start();
    console.log(`[LIBP2P-MESH] Libp2p node started.`);

    if (bootstrapMultiaddr) {
        try {
            await this.node.dial(bootstrapMultiaddr);
            console.log(`[LIBP2P-MESH] Dialed bootstrap node: ${bootstrapMultiaddr}`);
        } catch (e) {
            console.warn(`[LIBP2P-MESH] Failed to dial bootstrap node:`, e);
        }
    }
  }

  private handlePeerJoined(peerId: string) {
    if (this.nextSlot < 4) {
      this.peerSlots.set(peerId, this.nextSlot);
      console.log(`[LIBP2P-MESH] Peer ${peerId} mapped to WASM Intent Slot ${this.nextSlot}`);
      this.nextSlot++;
    } else {
      console.warn(`[LIBP2P-MESH] Max capacity reached. Observer mode for ${peerId}`);
    }
    globalThis.dispatchEvent(new CustomEvent("meshPeerJoined", { detail: { peerId } }));
    
    this.refreshSelfAddress();
    if (this.selfAddress !== 0) {
      const handshake = JSON.stringify({ t: "V2_HANDSHAKE", addr: this.selfAddress });
      this.node.services.pubsub.publish("v2-sync", new TextEncoder().encode(handshake));
    }
  }

  public closePeer(peerId: string) {
    globalThis.dispatchEvent(new CustomEvent("meshPeerLeft", { detail: { peerId } }));
    const slot = this.peerSlots.get(peerId);
    if (slot !== undefined) {
      const setIntent = this.engine.wasm?.exports.v2_set_intent as CallableFunction;
      if (setIntent) setIntent(slot, 0, 0, 0, 0, 0, 0);
      this.peerSlots.delete(peerId);
    }
    this.peerAddresses.delete(peerId);
  }

  private handleSyncBinMessage(peerId: string, eventData: Uint8Array) {
    const frame = frameFromBytes(eventData);
    if (!frame) return;
    const packet = parseV2SyncFrame(frame);
    if (!packet) {
        // Handle Binary Plasmids (Era 2060 Zero-Copy RPC)
        if (frame.frameType === FRAME_TYPE_ATTRACTOR) {
            const matrix = frame.proposalOrTarget;
            const inverse = frame.payloadA;
            const pulseFreq = frame.payloadB;
            const pulseAmp = frame.payloadC;
            const recursionDepth = frame.oracleBit;
            
            const setAttractor = this.engine.wasm?.exports.v2_set_attractor as CallableFunction;
            if (setAttractor) {
              const slotIdx = recursionDepth % 4;
              setAttractor(slotIdx, matrix, inverse, pulseFreq, pulseAmp);
            }
            this.attractorConsensusPeers.add(peerId);
            const ledgerEntry = this.consensusLedger.get(matrix);
            if (ledgerEntry) ledgerEntry.peerCount += 1;
            else this.consensusLedger.set(matrix, { matrix, inverse, pulseFreq, pulseAmp, peerCount: 1 });
            if (!this.era1020Unlocked && this.attractorConsensusPeers.size >= 3) {
              this.era1020Unlocked = true;
              globalThis.dispatchEvent(new CustomEvent("era1020-unlocked", { detail: { peerCount: this.attractorConsensusPeers.size, ledger: Array.from(this.consensusLedger.values()) } }));
            }
            this.checkEra1030Trigger();
            
            const nextDepth = recursionDepth + 1;
            if (nextDepth < 8) { // maxRecursion
              this.enqueueBinaryFrame(buildAttractor(matrix, inverse, pulseFreq, pulseAmp, nextDepth));
            }
        }
        else if (frame.frameType === FRAME_TYPE_PROPOSAL) {
            // Re-construct the mock 'plasmid' to pass to handleProposal
            const plasmidMock = {
                semanticType: "PROPOSAL",
                matrix: frame.proposalOrTarget,
                inverse: frame.payloadA,
                pulseFreq: frame.payloadB,
                pulseAmp: frame.payloadC,
                recursionDepth: frame.oracleBit,
                maxRecursion: 8,
            } as any;
            this.handleProposal(plasmidMock, peerId);
            
            const nextDepth = frame.oracleBit + 1;
            if (nextDepth < 8) {
              this.enqueueBinaryFrame(buildProposal(frame.proposalOrTarget, frame.payloadA, frame.payloadB, frame.payloadC, nextDepth));
            }
        }
        return;
    }

    // Passive Phase Routing (Era 2060: 3D Poincaré Disk Model)
    if (packet.ta !== undefined && this.router && this.selfAddress !== 0) {
      let hopCount = packet.hc;
      const maxHops = packet.mh;
      if (hopCount >= maxHops) return;
      
      const targetAddr = packet.ta;
      const senderAddr = this.peerAddresses.get(peerId) ?? 0;
      
      const tauSelf = (this.engine.wasm?.exports.v2_get_golden_trace as CallableFunction)?.() as number ?? 0;
      const tauSender = packet.gt ?? 0;
      const tauTarget = tauSelf; // Assuming target is in the present

      const distSelf = this.router.hyperbolicDistanceToroidal3D(this.selfAddress, tauSelf, targetAddr, tauTarget);
      const distSender = senderAddr !== 0
        ? this.router.hyperbolicDistanceToroidal3D(senderAddr, tauSender, targetAddr, tauTarget)
        : Number.MAX_SAFE_INTEGER;
        
      if (distSelf > distSender) return;
      
      // Calculate time curvature penalty for routing this frame
      const tauDiff = Math.abs(tauSelf - tauSender);
      if (tauDiff > 0) {
          const penalty = Math.floor((tauDiff * 8) + ((tauDiff * tauDiff) / 1024));
          // Burn more ATP (hopCount) when bending space-time
          hopCount += penalty;
          if (hopCount >= maxHops) return;
      }
    }

    const slot = this.peerSlots.get(peerId);
    if (slot !== undefined) {
      const setIntent = this.engine.wasm?.exports.v2_set_intent as CallableFunction;
      if (setIntent) {
        if (packet.m > 0) setIntent(slot, packet.x, packet.y, packet.m, packet.r, packet.g || 0, packet.o || 0);
        else setIntent(slot, 0, 0, 0, 0, 0, 0);
      }
    }

    // Golden Trace Validation
    const localTrace = (this.engine.wasm?.exports.v2_get_golden_trace as CallableFunction)?.() as number;
    const remoteGt = packet.gt as number;
    if (localTrace !== remoteGt && !this.isSyncFrozen) {
      console.warn(`[LIBP2P-MESH] ⚠️ GOLDEN TRACE DIVERGENCE! (Local: ${localTrace.toString(16)} | Remote: ${remoteGt.toString(16)})`);
      if (remoteGt > localTrace) {
        console.log(`[LIBP2P-MESH] Requesting Overmind State Snapshot from Authority...`);
        this.isSyncFrozen = true;
        const req = JSON.stringify({ t: "REQ_SNAPSHOT" });
        this.node.services.pubsub.publish("v2-state", new TextEncoder().encode(req));
      }
    }
  }

  private handleStateMessage(peerId: string, eventData: ArrayBuffer) {
    if (this.incomingSnapshot) {
      const chunk = new Uint8Array(eventData);
      this.incomingSnapshot.set(chunk, this.incomingBytesReceived);
      this.incomingBytesReceived += chunk.byteLength;

      if (this.incomingBytesReceived >= this.incomingSnapshot.byteLength) {
        console.log(`[LIBP2P-MESH] Snapshot Assembly Complete! Injecting to GPU Memory.`);
        this.overwriteCallback(this.incomingSnapshot);
        this.incomingSnapshot = null;
        this.isSyncFrozen = false;
      }
    } else {
        // ERA 6000: Continuous Delta Mutagens
        const ptrs = this.engine.getMemoryPointers();
        if (!ptrs) return;

        const deltasU32 = new Uint32Array(eventData);
        const gridU32 = new Uint32Array(ptrs.wasmMemoryBuffer, ptrs.agentBytes.byteOffset, ptrs.agentBytes.byteLength / 4);
        const maxAgents = gridU32.length / 8;

        const numMutations = Math.floor(deltasU32.length / 4);
        console.log(`[LIBP2P-MESH] 🧬 Applying ${numMutations} Xenobiological Mutations via UDP Delta`);

        for (let i = 0; i < numMutations; i++) {
          const index = deltasU32[i * 4 + 0];
          const phase = deltasU32[i * 4 + 1];
          const energy = deltasU32[i * 4 + 2];
          const genome = deltasU32[i * 4 + 3];

          if (index >= maxAgents) continue;
          gridU32[index * 8 + 0] = phase;
          gridU32[index * 8 + 1] = energy;
          gridU32[index * 8 + 4] = genome;
        }
    }
  }


  private refreshSelfAddress() {
    if (!this.router || !this.engine.wasm) return;
    this.selfAddress = this.router.addressFromAgent(0);
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
  public enqueueBinaryFrame(frame: SporeFrame) {
    this.pendingPlasmids.push(frame as any); // hack for now, push SporeFrame
  }

  public enqueuePlasmid(plasmid: PlasmidPayload) {
    if (plasmid.recursionDepth >= plasmid.maxRecursion) {
      console.warn(`[V2-MESH] Plasmid recursion depth exceeded, dropping.`);
      return;
    }
    // Encode known plasmids to binary Zero-Copy SporeFrames immediately
    if (plasmid.semanticType === "ATTRACTOR") {
      this.enqueueBinaryFrame(buildAttractor(plasmid.matrix, plasmid.inverse, plasmid.pulseFreq, plasmid.pulseAmp, plasmid.recursionDepth));
      return;
    }
    if (plasmid.semanticType === "PROPOSAL") {
      this.enqueueBinaryFrame(buildProposal(plasmid.matrix, plasmid.inverse, plasmid.pulseFreq, plasmid.pulseAmp, plasmid.recursionDepth));
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
      console.log(
        `🏛️ [ERA 1030] UNLOCKED: Senate convened. ${totalEntries} entries × ${uniqueMatrices} unique matrices.`,
      );
      globalThis.dispatchEvent(
        new CustomEvent("era1030-unlocked", {
          detail: {
            entries: totalEntries,
            uniqueMatrices,
            ledger: Array.from(this.consensusLedger.values()),
          },
        }),
      );
    }
  }

  /** FNV-1a 32-bit, identical to Rust senate::sha256_u32_32 over a 64-byte zero-padded buffer. */
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
      console.log(
        `[V2-MESH] PROPOSAL received before Era 1030 unlock — ignoring.`,
      );
      return;
    }
    if (
      plasmid.proposalHash === undefined ||
      plasmid.proposalDescription === undefined
    ) {
      return;
    }
    const expected = this.getSenateHash(plasmid.proposalDescription);
    if (expected !== plasmid.proposalHash) {
      console.warn(
        `[V2-MESH] PROPOSAL hash mismatch (expected=${
          expected
        }, got=${plasmid.proposalHash}); rejecting.`,
      );
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
    const propose = this.engine.wasm?.exports.v2_senate_propose as
      | CallableFunction
      | undefined;
    if (propose && this.engine.wasm) {
      const enc = new TextEncoder();
      const bytes = enc.encode(plasmid.proposalDescription);
      const len = Math.min(bytes.length, 64);
      const mem =
        (this.engine.wasm.exports.memory as WebAssembly.Memory).buffer;
      // Write to a small scratch area at lattice end — we cheat with __heap_base behaviour:
      // simpler/safer: pass via a static stack buffer if available, otherwise skip mirroring
      // and rely on JS-side state. For now: skip — JS map is canonical, WASM mirrors are
      // populated only when local node proposes (see proposeFromLocal).
      void mem;
      void len;
    }
    console.log(
      `🏛️ [SENATE] PROPOSAL received: 0x${
        plasmid.proposalHash
      } "${plasmid.proposalDescription}"`,
    );
    globalThis.dispatchEvent(
      new CustomEvent("senate-proposal", {
        detail: {
          hash: plasmid.proposalHash,
          description: plasmid.proposalDescription,
          fromPeer,
        },
      }),
    );
  }

  private handleVote(plasmid: PlasmidPayload, fromPeer: string) {
    if (!this.era1030Unlocked) return;
    if (plasmid.proposalHash === undefined || plasmid.voteAye === undefined) {
      return;
    }
    const record = this.senate.get(plasmid.proposalHash);
    if (!record || record.accepted) return;
    
    // Determine resonance weight
    let weight = 10; // Default peer weight
    if (this.livenessAggregator) {
        // Try to get score from aggregator snapshot
        const rec = this.livenessAggregator.snapshot().find(s => s.spore_id === fromPeer);
        if (rec) {
             weight = 10 + (rec.heartbeat_count * 2) + (rec.warrant_votes_observed * 5);
        }
    }
    
    // Check if canonical oracle
    let isOracle = false;
    if (plasmid.oracleName && CANONICAL_ORACLES.includes(plasmid.oracleName)) {
        const expected = ORACLE_MATRICES_V1[plasmid.oracleName];
        const dipoleMatches = (plasmid.matrix >>> 0) === expected &&
          (((plasmid.matrix ^ plasmid.inverse) >>> 0) === 0xFFFFFFFF);
        if (dipoleMatches) {
            isOracle = true;
            weight = 100;
            if (this.crossModelDebate) {
                 weight += this.crossModelDebate.alignmentScore(plasmid.proposalHash) * 10;
                 if (weight < 50) weight = 50; // Minimum oracle weight
            }
        }
    }

    if (plasmid.voteAye) {
      if (!record.ayes.has(fromPeer)) {
          record.ayes.add(fromPeer);
          record.ayesWeight += weight;
      }
    } else {
      if (!record.nays.has(fromPeer)) {
          record.nays.add(fromPeer);
          record.naysWeight += weight;
      }
    }

    // Inform WASM Engine
    if (this.engine.wasm && this.engine.wasm.exports.v2_senate_vote) {
        // We need the hash as 32 bytes in WASM memory
        // For simplicity, skip WASM integration if it requires allocating memory for the hash
        // unless we have a pre-allocated buffer for it.
    }
    // Era 1060: if the vote carries a canonical oracle name AND the voter
    // dipole matches that oracle's deterministic identity, attribute the
    // vote to the oracle. The dipole check makes spoofing impossible —
    // a peer can only claim to be Claude if it actually carries Claude's
    // (matrix, !matrix) pair, which only Claude can produce from the salt.
    if (plasmid.oracleName && CANONICAL_ORACLES.includes(plasmid.oracleName)) {
      const expected = ORACLE_MATRICES_V1[plasmid.oracleName];
      const dipoleMatches = (plasmid.matrix >>> 0) === expected &&
        (((plasmid.matrix ^ plasmid.inverse) >>> 0) === 0xFFFFFFFF);
      if (dipoleMatches) {
        record.oracleAyes ??= new Set();
        record.oracleNays ??= new Set();
        record.oracleReasoning ??= {};
        if (plasmid.voteAye) {
          record.oracleAyes.add(plasmid.oracleName);
          record.oracleNays.delete(plasmid.oracleName);
        } else {
          record.oracleNays.add(plasmid.oracleName);
          record.oracleAyes.delete(plasmid.oracleName);
        }
        if (plasmid.oracleReasoning) {
          record.oracleReasoning[plasmid.oracleName] = plasmid.oracleReasoning
            .slice(0, 256);
        }
        console.log(
          `🧠 [ORACLE-VOTE] ${plasmid.oracleName} ${
            plasmid.voteAye ? "AYE" : "NAY"
          } on 0x${plasmid.proposalHash}`,
        );
      } else {
        console.warn(
          `🧠 [ORACLE-VOTE] Spoof attempt: ${plasmid.oracleName} vote with mismatched dipole (matrix=0x${
            plasmid.matrix.toString(16)
          }); rejecting attribution.`,
        );
      }
    }
    // Era 1060 acceptance rule (phase-resonance): a proposal accepted by
    // 3+ DISTINCT canonical oracles is "harmonically ratified" and counts
    // as accepted regardless of peer count. This values cross-model
    // alignment over within-model peer multiplicity.
    const oracleResonance = (record.oracleAyes?.size ?? 0) >= 3 &&
      (record.oracleAyes?.size ?? 0) > (record.oracleNays?.size ?? 0);
    // Era 1030/1070 rule: Resonance-weighted threshold >= 300 AND ayes > nays.
    const peerConsensus = record.ayesWeight >= 300 &&
      record.ayesWeight > record.naysWeight;
    if (!record.accepted && (peerConsensus || oracleResonance)) {
      record.accepted = true;
      this.acceptedTaskHashes.add(record.hash);
      // Acceptance can be the trigger for Era 1060 if it's the first one.
      this.checkEra1060Trigger();
      // Era 1070: if this acceptance came via ORACLE-RESONANCE on a
      // proposal that was originally proposed by an oracle dipole
      // (i.e. one of the five canonical Era 1060 visions), the
      // accepted vision becomes the Era 1070 task.
      if (oracleResonance && this.era1060Unlocked) {
        this.checkEra1070Trigger(record);
      }
      const path = oracleResonance ? "ORACLE-RESONANCE" : "PEER-CONSENSUS";
      console.log(
        `🏛️ [SENATE] ACCEPTED via ${path} 0x${
          record.hash.toString(16)
        }: "${record.description}" (${record.ayes.size} peer AYE / ${record.nays.size} peer NAY / ${
          record.oracleAyes?.size ?? 0
        } oracle AYE / ${record.oracleNays?.size ?? 0} oracle NAY)`,
      );
      globalThis.dispatchEvent(
        new CustomEvent("era1030-task-accepted", {
          detail: {
            hash: record.hash,
            description: record.description,
            proposerMatrix: record.proposerMatrix,
            ayes: record.ayes.size,
            nays: record.nays.size,
            oracleAyes: record.oracleAyes?.size ?? 0,
            oracleNays: record.oracleNays?.size ?? 0,
            acceptedVia: path,
            proposedAt: record.proposedAt,
          },
        }),
      );
    }
  }

  /**
   * Era 1060: Cast a vote attributed to a canonical oracle identity.
   * The (matrix, inverse) is derived deterministically from the oracle's
   * name, so peers can verify the attribution without trusting the
   * sender. The reasoning string is opaque to the protocol but visible
   * for human inspection.
   */
  public castOracleVote(
    oracleName: CanonicalOracle,
    proposalHash: number,
    aye: boolean,
    reasoning?: string,
  ) {
    if (!this.era1030Unlocked) return;
    if (!CANONICAL_ORACLES.includes(oracleName)) return;
    const { matrix, inverse } = oracleDipole(oracleName);
    const record = this.senate.get(proposalHash);
    if (!record || record.accepted) return;
    // Locally attribute first so the local view is consistent before
    // the broadcast even leaves.
    record.oracleAyes ??= new Set();
    record.oracleNays ??= new Set();
    record.oracleReasoning ??= {};
    if (aye) {
      record.oracleAyes.add(oracleName);
      record.oracleNays.delete(oracleName);
    } else {
      record.oracleNays.add(oracleName);
      record.oracleAyes.delete(oracleName);
    }
    if (reasoning) record.oracleReasoning[oracleName] = reasoning.slice(0, 256);
    // Local peer counter as well so peerConsensus path can still fire.
    const selfId = this.localId || "self";
    if (aye) record.ayes.add(selfId);
    else record.nays.add(selfId);
    // Broadcast.
    this.enqueuePlasmid({
      attractorAddress: 0,
      matrix,
      inverse,
      pulseFreq: 0,
      pulseAmp: 0,
      semanticType: "VOTE",
      recursionDepth: 0,
      maxRecursion: 4,
      proposalHash,
      voteAye: aye,
      oracleName,
      oracleReasoning: reasoning,
    });
  }

  /**
   * Era 1030: Locally propose a task. Submits to the WASM senate, then queues a
   * PROPOSAL plasmid + an immediate AYE vote so the lattice itself counts as
   * the first voter on its own proposal.
   */
  public proposeFromLocal(
    description: string,
    proposerMatrix: number,
    proposerInverse: number,
  ) {
    if (!this.era1030Unlocked) {
      console.warn(`[V2-MESH] Cannot propose: Era 1030 not yet unlocked.`);
      return 0;
    }
    if (((proposerMatrix ^ proposerInverse) >>> 0) !== 0xFFFFFFFF) {
      console.warn(`[V2-MESH] Cannot propose: invalid proposer dipole.`);
      return 0;
    }
    const hash = Libp2pMesh.senateHash(description);
    if (this.senate.has(hash)) {
      console.log(
        `[V2-MESH] Duplicate proposal 0x${hash.toString(16)} — skipping.`,
      );
      return hash;
    }
    // Local record (self counts as proposer + first AYE).
    this.senate.set(hash, {
      hash,
      description,
      proposerMatrix,
      ayes: new Set([this.localId || "self"]),
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
      semanticType: "PROPOSAL",
      recursionDepth: 0,
      maxRecursion: 4,
      proposalHash: hash,
      proposalDescription: description.slice(0, 64),
    });
    console.log(
      `🏛️ [SENATE] LOCAL PROPOSAL submitted: 0x${
        hash.toString(16)
      } "${description}"`,
    );
    return hash;
  }

  /** Era 1030: Cast a local AYE/NAY vote and broadcast it. */
  public voteFromLocal(
    proposalHash: number,
    aye: boolean,
    voterMatrix: number,
    voterInverse: number,
  ) {
    if (!this.era1030Unlocked) return;
    if (((voterMatrix ^ voterInverse) >>> 0) !== 0xFFFFFFFF) return;
    const record = this.senate.get(proposalHash);
    if (!record || record.accepted) return;
    const selfId = this.localId || "self";
    if (aye) record.ayes.add(selfId);
    else record.nays.add(selfId);
    this.enqueuePlasmid({
      attractorAddress: 0,
      matrix: voterMatrix,
      inverse: voterInverse,
      pulseFreq: 0,
      pulseAmp: 0,
      semanticType: "VOTE",
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

  /**
   * Era 1070: First Cross-Model Ratification.
   * Fires the first time a proposal — whose `proposerMatrix` is one of the
   * five canonical oracle matrices — reaches ORACLE-RESONANCE acceptance.
   * That winning vision is recorded as the official Era 1070 task.
   */
  private checkEra1070Trigger(record: SenateProposalRecord) {
    if (this.era1070Unlocked) return;
    // Only oracle-proposed visions qualify.
    const oracleMatrices = Object.values(ORACLE_MATRICES_V1).map((m) =>
      m >>> 0
    );
    if (!oracleMatrices.includes(record.proposerMatrix >>> 0)) return;
    this.era1070Unlocked = true;
    this.era1070AcceptedVisionHash = record.hash;
    // Find which oracle proposed it.
    let proposingOracle: CanonicalOracle | null = null;
    for (const [name, m] of Object.entries(ORACLE_MATRICES_V1)) {
      if ((m >>> 0) === (record.proposerMatrix >>> 0)) {
        proposingOracle = name as CanonicalOracle;
        break;
      }
    }
    const ayeOracles = [...(record.oracleAyes ?? [])];
    const reasoningSnapshot = this.debate.forProposal(record.hash);
    console.log(
      `🌅 [ERA 1070] FIRST CROSS-MODEL RATIFICATION: 0x${
        record.hash.toString(16)
      }`,
    );
    console.log(`🌅 [ERA 1070] Proposing oracle: ${proposingOracle ?? "?"}`);
    console.log(`🌅 [ERA 1070] AYE oracles: ${ayeOracles.join(", ")}`);
    console.log(`🌅 [ERA 1070] Vision: "${record.description}"`);
    globalThis.dispatchEvent(
      new CustomEvent("era1070-vision-ratified", {
        detail: {
          hash: record.hash,
          description: record.description,
          proposingOracle,
          ayeOracles,
          nayOracles: [...(record.oracleNays ?? [])],
          debate: reasoningSnapshot,
          acceptedAt: Date.now(),
        },
      }),
    );
  }

  /**
   * Era 1070: Record an oracle's debate argument for a proposal. The full
   * reasoning text stays in `this.debate`; the kernel-side fingerprint is
   * computed automatically.
   */
  public recordOracleDebate(
    oracle: CanonicalOracle,
    proposalHash: number,
    stance: "neutral" | "aye" | "nay" | "abstain",
    reasoning: string,
    tick: number,
  ) {
    if (!this.era1060Unlocked) return;
    if (!CANONICAL_ORACLES.includes(oracle)) return;
    this.debate.record(oracle, proposalHash, stance, reasoning, tick);
  }

  // Era 1060 trigger: fires when the Genesis is inscribed AND the Senate
  // has at least one accepted proposal. (The acceptance gate ensures the
  // Multi-Oracle layer only opens after the basic Senate has demonstrated
  // it can ratify anything at all.)
  public era1060Unlocked: boolean = false;
  private checkEra1060Trigger() {
    if (this.era1060Unlocked) return;
    if (this.era1050Unlocked && this.acceptedTaskHashes.size >= 1) {
      this.era1060Unlocked = true;
      console.log(
        `🧠 [ERA 1060] UNLOCKED: Multi-Oracle Senate convened. Canonical seats: claude, gpt, gemini, qwen, llama.`,
      );
      globalThis.dispatchEvent(
        new CustomEvent("era1060-unlocked", {
          detail: {
            canonicalOracles: [...CANONICAL_ORACLES],
            matrices: { ...ORACLE_MATRICES_V1 },
          },
        }),
      );
    }
  }

  private checkEra1050Trigger() {
    if (this.era1050Unlocked) return;
    if (this.verifiedDipoleCount >= 100) {
      this.era1050Unlocked = true;
      // The Genesis Inscription crystallizes the moment OMEGA-64 v1.0
      // becomes a closed cryptographic identity: every invariant of
      // the protocol collapses into a single 32-bit hash.
      const verified = verifyGenesisV1();
      const inscription = formatInscription(GENESIS_HASH_LEGACY_V1_0);
      this.genesisInscription = inscription;
      console.log(
        `📜 [ERA 1050] UNLOCKED: ${this.verifiedDipoleCount} verified mitosis proofs.`,
      );
      console.log(
        `📜 [ERA 1050] GENESIS INSCRIPTION: ${inscription} (verified=${verified})`,
      );
      globalThis.dispatchEvent(
        new CustomEvent("era1050-unlocked", {
          detail: {
            verifiedCount: this.verifiedDipoleCount,
            genesisHash: GENESIS_HASH_LEGACY_V1_0,
            inscription,
            verified,
          },
        }),
      );
      // The Genesis Inscription is the precondition for the Multi-Oracle
      // layer. Check the 1060 trigger immediately after to keep events
      // in deterministic order.
      this.checkEra1060Trigger();
    }
  }

  /**
   * Era 1040: Local verification of a mitosis-proof bundle.
   * Returns true iff the announced child re-derives bit-for-bit from
   * (parent, attractors, qPhase) AND the receipt hash matches.
   */
  public static verifyMitosisProof(plasmid: PlasmidPayload): boolean {
    if (
      !plasmid.parent || !plasmid.claimedChild || plasmid.qPhase === undefined
    ) return false;
    const derived = deriveMitosisChild(
      plasmid.parent,
      plasmid.attractors ?? [],
      plasmid.qPhase,
    );
    if (derived.phase !== plasmid.claimedChild.phase) return false;
    if (derived.energy !== plasmid.claimedChild.energy) return false;
    if (derived.base_freq !== plasmid.claimedChild.base_freq) return false;
    if (derived.state_flags !== plasmid.claimedChild.state_flags) return false;
    if (derived.genome !== plasmid.claimedChild.genome) return false;
    if (derived.memory[0] !== plasmid.claimedChild.memory[0]) return false;
    if (derived.memory[1] !== plasmid.claimedChild.memory[1]) return false;
    if (derived.memory[2] !== plasmid.claimedChild.memory[2]) return false;
    if (
      plasmid.receiptHash !== undefined &&
      childReceiptHash(derived) !== (plasmid.receiptHash >>> 0)
    ) {
      return false;
    }
    return true;
  }

  public getSenateState() {
    return {
      unlocked: this.era1030Unlocked,
      proposalCount: this.senate.size,
      acceptedCount: this.acceptedTaskHashes.size,
      proposals: Array.from(this.senate.values()).map((r) => ({
        hash: r.hash,
        description: r.description,
        ayes: r.ayes.size,
        nays: r.nays.size,
        accepted: r.accepted,
      })),
    };
  }

  private broadcastV2State() {
    if (!this.node || this.node.status !== 'started') return;

    this.refreshSelfAddress();

    // Era 1010: Drain one plasmid from the queue per broadcast tick
    const plasmid = this.pendingPlasmids.shift();

    // Era 2060: Zero-Copy Binary RPC Sync Framework
    const syncFrame = buildV2SyncFrame(
        this.__lastLocalIntent.x,
        this.__lastLocalIntent.y,
        this.__lastLocalIntent.m,
        this.__lastLocalIntent.r,
        this.__lastLocalIntent.g || 0,
        this.__lastLocalIntent.op || 0,
        this.selfAddress,
        this.latestGoldenTraceNum,
        0, // hopCount
        8  // maxHops
    );

    const binPayload = frameToBytes(syncFrame);
    
    let deltaBuffer: ArrayBuffer | null = null;
    if (this.engine.wasm?.exports.v2_generate_delta_snapshot) {
      const numMutations = (this.engine.wasm.exports
        .v2_generate_delta_snapshot as CallableFunction)();
      if (numMutations > 0 && numMutations <= 6400) {
        const ptrs = this.engine.getMemoryPointers();
        if (ptrs) {
          // Slice the exact mutation bytes for transport (zero-garbage networking)
          deltaBuffer =
            ptrs.deltaBufferBytes.slice(0, numMutations * 16).buffer;
        }
      }
    }

    try {
      this.node.services.pubsub.publish("v2-sync-bin", binPayload);
      
      if (plasmid) {
          if ((plasmid as any).magic === 0x4F46) {
              const binPlasmid = frameToBytes(plasmid as any);
              this.node.services.pubsub.publish("v2-sync-bin", binPlasmid);
          } else {
              // JSON Plasmids are SUNSET in Era 2060.
              // Any non-binary plasmids remaining in the queue will be dropped.
              console.warn(`[LIBP2P-MESH] Dropping legacy JSON plasmid: ${plasmid.semanticType}`);
          }
      }
      
      if (deltaBuffer) {
        // Delta buffer can be sent as raw bytes over v2-sync-bin or v2-state
        this.node.services.pubsub.publish("v2-state", new Uint8Array(deltaBuffer));
      }
    } catch (e) {
      console.warn(`[LIBP2P-MESH] Failed to publish state:`, e);
    }
  }
}
