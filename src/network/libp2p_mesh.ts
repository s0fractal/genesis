// This is the in-app libp2p node (gossipsub + DHT + the full transport set).
// As of 2026-06-28 it type-checks under Deno (`deno check` clean) after the v3
// API fixes (identify service + connectionEncrypters). The relay-based mesh it
// belongs to is LIVE and proven via `tools/mesh_relay_node.ts` + `tools/mesh.ts`
// (relay relay.myc.md, content-sync, self-discovery, signature verification).
// As of 2026-08-01 the senate control plane is WIRED: PROPOSAL / VOTE / DIPOLE
// plasmids travel as JSON on the dedicated "v2-senate" topic (a VOTE carries a
// 64-byte Ed25519 custody signature; a DIPOLE carries two agents + attractor
// field — neither fits a 32-byte SporeFrame). DIPOLE accounting (the genesis-inscription
// odometer) lives in the pure, unit-tested `dipole_accounting.ts`.
// What's NOT yet done here: this file is still not instantiated by a running
// daemon, and a standing gossipsub data plane wants DCUtR hole-punching
// (relayed conns are "limited"). See docs/MESH_RELAY.md and
// docs/KNOWN_GAPS.md. The quorum_warrant_bridge_test.ts integration uses a
// canonical inline hash reference rather than importing this file.
import { OmegaV2Engine } from "../environment/v2_bridge.ts";
import { NULL_ADDRESS, PhaseAddress, PhaseRouter } from "./routing_bridge.ts";
import { AgentMinimal, AttractorEntry } from "./mitosis_proof.ts";
import {
  formatInscription,
  GENESIS_HASH_LEGACY_V1_0,
  verifyGenesisV1,
} from "./genesis_inscription.ts";
import { sha256_u32 } from "../sdk/phi_crypto.ts";
import {
  CANONICAL_ORACLES,
  CanonicalOracle,
  ORACLE_MATRICES_V1,
  oracleDipole,
} from "./oracle_identity.ts";
import {
  hasOracleKey,
  signOracleVote,
  verifyOracleVote,
} from "./oracle_custody.ts";
import { CrossModelDebate } from "./cross_model_debate.ts";
import {
  DivergenceRecovery,
  MAX_MUTATIONS_PER_MESSAGE,
  sanitizeDeltaMutation,
} from "./sync_recovery.ts";
import {
  buildAttractor,
  buildProposal,
  buildV2SyncFrame,
  FRAME_TYPE_ATTRACTOR,
  FRAME_TYPE_PROPOSAL,
  frameFromBytes,
  frameToBytes,
  parseV2SyncFrame,
  SporeFrame,
} from "./spore_frame.ts";
import { LivenessAggregator } from "./liveness_aggregator.ts";
import {
  DipoleAccountant,
  verifyDipoleAnnouncement,
} from "./dipole_accounting.ts";

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
    | "ZK_PROOF_EVENT"
    | "ZK_ROLLUP_EVENT";
  parentHash?: number;
  recursionDepth: number;
  maxRecursion: number;
  // Senate payload extensions
  proposalHash?: number; // FNV-1a hash of description (PROPOSAL + VOTE)
  proposalDescription?: string; // Up to 64 chars, truncated server-side (PROPOSAL only)
  voteAye?: boolean; // VOTE plasmids only
  // Bitcoin Hyperbolic Geometry (Time Curvature)
  tau?: number; // The Bitcoin block height (Golden Trace state) when this plasmid was forged
  gt?: number; // sender's PhaseAddress raw
  gt_ortho?: number; // sender's PhaseAddress ortho
  ta?: number; // target's PhaseAddress raw
  ta_ortho?: number; // target's PhaseAddress ortho
  // ZK-Notarized Mutations (mitosis proof)
  parent?: AgentMinimal; // Parent agent at time of mitosis (DIPOLE only)
  claimedChild?: AgentMinimal; // Claimed child to verify (DIPOLE only)
  attractors?: AttractorEntry[]; // Snapshot of attractor field (DIPOLE only)
  qPhase?: number; // Topology q_phase at time of mitosis (DIPOLE only)
  receiptHash?: string; // Pre-computed FNV-1a child hash (DIPOLE only)
  entropyDelta?: number; // Shift in Kuramoto order (DIPOLE only)
  metabolicCost?: number; // Energy burned during birth (DIPOLE only)
  proofBundle?: import("./zk_prover_bridge.ts").ZKProofBundle; // SP1 STARK Proof
  rollupState?: Uint8Array; // The full PhaseAgent array corresponding to a rollup proof
  // Multi-Oracle Senate vote attribution (VOTE plasmids only).
  oracleName?: CanonicalOracle; // The oracle casting this vote (claude/gpt/...)
  oracleReasoning?: string; // Optional human-readable reasoning trace (≤256 chars)
  oracleSig?: string; // base64 Ed25519 signature over oracleVoteDigest — REAL
  // custody. Without a valid sig the vote is NOT attributed to the oracle
  // (see oracle_custody.ts; the public dipole alone is no longer authority).
  // Forensic event sync envelope. Carries serialized
  // BridgeMessage JSON  so the
  // mesh's plasmid pipeline can deliver event-convergence packets
  // peer-to-peer. Receivers route to their local WebRTCEventBridge.
  eventSyncBody?: string; // EVENT_SYNC plasmids only
  eventSyncTarget?: number; // peer_id of the recipient (number)
  // Translation policy claim envelope. Carries serialized
  // TranslationPolicyClaim JSON .
  translationPolicyBody?: string; // TRANSLATION_POLICY plasmids only
  translationPolicyTarget?: number; // peer_id of the recipient (number)
  // Translation policy corroboration raise envelope.
  // Carries serialized TranslationPolicyCorroborationRaise JSON.
  translationPolicyCorroborationBody?: string; // TRANSLATION_POLICY_CORROBORATION only
  translationPolicyCorroborationTarget?: number; // peer_id of recipient
  // Translation policy forensic replay digest claim.
  // Carries serialized TranslationPolicyReplayDigestClaim JSON.
  translationPolicyReplayDigestBody?: string; // TRANSLATION_POLICY_REPLAY_DIGEST only
  translationPolicyReplayDigestTarget?: number; // peer_id of recipient
  // Translation policy recursive digests are deprecated.
  // Use primary diagnostic telemetry instead.
}

export interface SenateProposalRecord {
  hash: number;
  description: string;
  proposerMatrix: number;
  ayes: Set<string>; // unique peer IDs
  nays: Set<string>;
  ayesWeight: number; // Resonance-weighted
  naysWeight: number;
  accepted: boolean;
  localObservedAtMs: number; // non-consensus metadata
  proposedAtTau: number; // consensus ordering
  proposedAtTick?: number; // micro consensus ordering
  // oracle-attributed votes (peer-id-independent).
  oracleAyes?: Set<CanonicalOracle>;
  oracleNays?: Set<CanonicalOracle>;
  oracleReasoning?: Record<string, string>;
}

import { createLibp2p, Libp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { noise, pureJsCrypto } from "@chainsafe/libp2p-noise";
import { yamux } from "@libp2p/yamux";
import { kadDHT } from "@libp2p/kad-dht";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { webRTC } from "@libp2p/webrtc";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { identify } from "@libp2p/identify"; // gossipsub requires it (libp2p v3)
import { senateVoteWeight } from "./senate_weight.ts";
import {
  senateHash as canonicalSenateHash,
  ZK_NOTARIZATION_PROPOSAL,
} from "./senate_proposals.ts";

/**
 * The Mycelial Mesh
 * Libp2p GossipSub + Kademlia DHT Decentralized Mesh
 */
export class Libp2pMesh {
  private node!: any;
  private localId: string = "";
  private engine: OmegaV2Engine;

  private peerSlots: Map<string, number> = new Map();
  private peerAddresses: Map<string, PhaseAddress> = new Map();
  private nextSlot = 1;
  private router: PhaseRouter | null = null;
  private selfAddress: PhaseAddress = { raw: 0, ortho: 0 };

  public get isSyncFrozen(): boolean {
    return this.syncRecovery.isFrozen(Date.now());
  }
  // T6: liveness + boundary guards for the v2-state channel. The divergence
  // freeze now times out (REQ_SNAPSHOT has no responder anywhere in the
  // codebase — the old code froze the local physics forever).
  private syncRecovery: DivergenceRecovery = new DivergenceRecovery();
  private overwriteCallback: (snapshot: Uint8Array) => void;

  // Snapshot Reassembly State
  private incomingSnapshot: Uint8Array | null = null;
  private incomingBytesReceived: number = 0;

  // Attractor Consensus Tracking
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
  public attractorConsensusReached: boolean = false;

  // Autopoietic Senate
  public senateConvened: boolean = false;
  public senate: Map<number, SenateProposalRecord> = new Map();
  private acceptedTaskHashes: Set<number> = new Set();

  // ZK-Notarized Mutations counter (counts successfully verified DIPOLE
  // proofs). The accounting itself lives in the pure, unit-testable
  // `DipoleAccountant` (src/network/dipole_accounting.ts).
  private dipoleAccountant: DipoleAccountant = new DipoleAccountant();
  public get verifiedDipoleCount(): number {
    return this.dipoleAccountant.verifiedCount;
  }

  // Cross-model debate ledger (full-text store, key = proposalHash).
  public debate: CrossModelDebate = new CrossModelDebate();
  public visionRatified: boolean = false;
  public acceptedVisionHash: number | null = null;
  public livenessAggregator?: LivenessAggregator;
  /** How many configured bootstrap nodes actually answered the dial. */
  public bootstrapReached: number = 0;

  constructor(
    engine: OmegaV2Engine,
    overwriteCallback: (snapshot: Uint8Array) => void,
    // Accepts one multiaddr or a list. A list is the point: a single hardcoded
    // bootstrapper is a single point of discovery failure in a mesh that
    // advertises having no centralized relay.
    bootstrapMultiaddr?: string | string[],
    router?: PhaseRouter,
  ) {
    this.engine = engine;
    this.overwriteCallback = overwriteCallback;
    this.router = router ?? null;

    this.initNode(bootstrapMultiaddr);

    // Start the 30Hz broadcast loop
    setInterval(() => this.broadcastV2State(), 1000 / 30);
  }

  // Verifier-side senate hash. Delegates to the one canonical function so the
  // proposer's key and the receiver's check can never disagree again (they used
  // to: one padded, one didn't).
  private computeSenateHash(str: string | undefined): number {
    if (!str) return 0;
    return Libp2pMesh.senateHash(str);
  }

  private async initNode(bootstrapMultiaddr?: string | string[]) {
    // @ts-ignore: Peer-dependency version mismatches in libp2p modules
    this.node = await createLibp2p({
      transports: [
        // @ts-ignore
        webSockets(),
        // @ts-ignore
        webRTC({
          rtcConfiguration: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:global.stun.twilio.com:3478" },
            ],
          },
        }),
        // @ts-ignore
        circuitRelayTransport({ discoverRelays: 1 } as any),
      ],
      // libp2p v3: key is `connectionEncrypters` (plural); the old
      // `connectionEncryption` is silently ignored → no security transport →
      // the node can't complete a connection. (Surfaced by the Phase-1 mesh
      // proof, tools/mesh_p2p_proof.ts, chord x3300_955774.)
      connectionEncrypters: [noise({ crypto: pureJsCrypto })],
      streamMuxers: [yamux()],
      services: {
        // @ts-ignore
        identify: identify(), // required by gossipsub on libp2p v3
        // @ts-ignore
        dht: kadDHT(),
        // @ts-ignore
        pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
      },
    });

    this.localId = this.node.peerId.toString();
    console.log(`[LIBP2P-MESH] My Node ID: ${this.localId}`);

    this.node.addEventListener("peer:connect", (evt: any) => {
      const peerId = evt.detail.toString();
      console.log(`[LIBP2P-MESH] Connection established to: ${peerId}`);
      this.handlePeerJoined(peerId);
    });

    this.node.addEventListener("peer:disconnect", (evt: any) => {
      const peerId = evt.detail.toString();
      console.log(`[LIBP2P-MESH] Disconnected from: ${peerId}`);
      this.closePeer(peerId);
    });

    this.node.services.pubsub.addEventListener("message", (evt: any) => {
      if (evt.detail.topic === "v2-sync-bin") {
        this.handleSyncBinMessage(
          evt.detail.from.toString(),
          new Uint8Array(evt.detail.data),
        );
      } else if (evt.detail.topic === "v2-state") {
        this.handleStateMessage(
          evt.detail.from.toString(),
          evt.detail.data.buffer as ArrayBuffer,
        );
      } else if (evt.detail.topic === "v2-zk-proof") {
        this.handleZKProofMessage(evt.detail.from.toString(), evt.detail.data);
      } else if (evt.detail.topic === "v2-zk-rollup") {
        this.handleZKRollupMessage(evt.detail.from.toString(), evt.detail.data);
      } else if (evt.detail.topic === "v2-senate") {
        this.handleSenateMessage(evt.detail.from.toString(), evt.detail.data);
      }
    });

    this.node.services.pubsub.subscribe("v2-sync-bin");
    this.node.services.pubsub.subscribe("v2-state");
    this.node.services.pubsub.subscribe("v2-zk-proof");
    this.node.services.pubsub.subscribe("v2-zk-rollup");
    this.node.services.pubsub.subscribe("v2-senate");

    await this.node.start();
    console.log(`[LIBP2P-MESH] Libp2p node started.`);

    // Dial every configured bootstrapper concurrently and keep going as long as
    // ONE answered. Discovery must not hinge on any single operator's uptime.
    const addrs =
      (Array.isArray(bootstrapMultiaddr)
        ? bootstrapMultiaddr
        : bootstrapMultiaddr
        ? [bootstrapMultiaddr]
        : []).filter((a) => typeof a === "string" && a.length > 0);

    if (addrs.length > 0) {
      const results = await Promise.allSettled(
        addrs.map((addr) =>
          this.node.dial(addr).then(() => {
            console.log(`[LIBP2P-MESH] Dialed bootstrap node: ${addr}`);
            return addr;
          }).catch((e: unknown) => {
            console.warn(
              `[LIBP2P-MESH] Failed to dial bootstrap node ${addr}:`,
              e,
            );
            throw e;
          })
        ),
      );
      this.bootstrapReached = results.filter((r) =>
        r.status === "fulfilled"
      ).length;
      if (this.bootstrapReached === 0) {
        console.warn(
          `[LIBP2P-MESH] No bootstrap node reachable (${addrs.length} tried). Running isolated until a peer dials in — override the list via __OMEGA_BOOTSTRAP_PEERS__ / OMEGA_BOOTSTRAP_PEERS / localStorage["omega.bootstrapPeers"].`,
        );
      } else {
        console.log(
          `[LIBP2P-MESH] Bootstrap: ${this.bootstrapReached}/${addrs.length} node(s) reached.`,
        );
      }
    }
  }

  private handlePeerJoined(peerId: string) {
    if (this.nextSlot < 4) {
      this.peerSlots.set(peerId, this.nextSlot);
      console.log(
        `[LIBP2P-MESH] Peer ${peerId} mapped to WASM Intent Slot ${this.nextSlot}`,
      );
      this.nextSlot++;
    } else {
      console.warn(
        `[LIBP2P-MESH] Max capacity reached. Observer mode for ${peerId}`,
      );
    }
    globalThis.dispatchEvent(
      new CustomEvent("meshPeerJoined", { detail: { peerId } }),
    );

    this.refreshSelfAddress();
    if (this.selfAddress.raw !== 0) {
      const handshake = JSON.stringify({
        t: "V2_HANDSHAKE",
        addr: this.selfAddress.raw,
        addr_ortho: this.selfAddress.ortho,
      });
      this.node.services.pubsub.publish(
        "v2-sync",
        new TextEncoder().encode(handshake),
      );
    }
  }

  public closePeer(peerId: string) {
    globalThis.dispatchEvent(
      new CustomEvent("meshPeerLeft", { detail: { peerId } }),
    );
    const slot = this.peerSlots.get(peerId);
    if (slot !== undefined) {
      const setIntent = this.engine.wasm?.exports
        .v2_set_intent as CallableFunction;
      if (setIntent) setIntent(slot, 0, 0, 0, 0, 0, 0);
      this.peerSlots.delete(peerId);
    }
    this.peerAddresses.delete(peerId);
  }

  private handleSyncBinMessage(peerId: string, eventData: Uint8Array) {
    // Absolute Immune Quarantine (OSI L4 Hardware Drop)
    // We don't even parse bytes from quarantined peers.
    if (
      (this as any).investigator?.isQuarantined?.(peerId) ||
      (this as any).livenessAggregator?.isQuarantined?.(peerId)
    ) {
      return;
    }
    const frame = frameFromBytes(eventData);
    if (!frame) return;
    const packet = parseV2SyncFrame(frame);
    if (!packet) {
      // Handle Binary Plasmids
      if (frame.frameType === FRAME_TYPE_ATTRACTOR) {
        const matrix = frame.proposalOrTarget;
        const inverse = frame.payloadA;
        const pulseFreq = frame.payloadB;
        const pulseAmp = frame.payloadC;
        const recursionDepth = frame.oracleBit;

        const setAttractor = this.engine.wasm?.exports
          .v2_set_attractor as CallableFunction;
        if (setAttractor) {
          const slotIdx = recursionDepth % 4;
          setAttractor(slotIdx, matrix, inverse, pulseFreq, pulseAmp);
        }
        this.attractorConsensusPeers.add(peerId);
        const ledgerEntry = this.consensusLedger.get(matrix);
        if (ledgerEntry) ledgerEntry.peerCount += 1;
        else {this.consensusLedger.set(matrix, {
            matrix,
            inverse,
            pulseFreq,
            pulseAmp,
            peerCount: 1,
          });}
        if (
          !this.attractorConsensusReached &&
          this.attractorConsensusPeers.size >= 3
        ) {
          this.attractorConsensusReached = true;
          globalThis.dispatchEvent(
            new CustomEvent("attractor-consensus-reached", {
              detail: {
                peerCount: this.attractorConsensusPeers.size,
                ledger: Array.from(this.consensusLedger.values()),
              },
            }),
          );
        }
        this.checkSenateConvened();

        const nextDepth = recursionDepth + 1;
        if (nextDepth < 8) { // maxRecursion
          this.enqueueBinaryFrame(
            buildAttractor(matrix, inverse, pulseFreq, pulseAmp, nextDepth),
          );
        }
      } else if (frame.frameType === FRAME_TYPE_PROPOSAL) {
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
          this.enqueueBinaryFrame(
            buildProposal(
              frame.proposalOrTarget,
              frame.payloadA,
              frame.payloadB,
              frame.payloadC,
              nextDepth,
            ),
          );
        }
      }
      return;
    }

    // Passive Phase Routing
    if (packet.ta !== undefined && this.router && this.selfAddress.raw !== 0) {
      let hopCount = packet.hc;
      const maxHops = packet.mh;
      if (hopCount >= maxHops) return;

      const senderAddr = { raw: packet.ta, ortho: packet.ta_ortho ?? 0 }; // ta holds the sender's address in broadcasts!
      const targetAddr = { raw: 0, ortho: 0 }; // Broadcast to everyone

      const tauSelf = (this.engine.wasm?.exports
        .v2_get_golden_trace as CallableFunction)?.() as number ?? 0;
      const tauSender = packet.gt ?? 0; // gt is the golden trace tick
      const tauTarget = tauSelf; // Assuming target is in the present

      const distSelf = this.router.hyperbolicDistanceToroidal3D(
        this.selfAddress,
        tauSelf,
        targetAddr,
        tauTarget,
      );
      const distSender = senderAddr.raw !== 0
        ? this.router.hyperbolicDistanceToroidal3D(
          senderAddr,
          tauSender,
          targetAddr,
          tauTarget,
        )
        : Number.MAX_SAFE_INTEGER;

      if (distSelf > distSender) return;

      // Calculate time curvature penalty for routing this frame
      const tauDiff = Math.abs(tauSelf - tauSender);
      if (tauDiff > 0) {
        const penalty = Math.floor(
          (tauDiff * 8) + ((tauDiff * tauDiff) / 1024),
        );
        // Burn more ATP (hopCount) when bending space-time
        hopCount += penalty;
        if (hopCount >= maxHops) return;
      }
    }

    const slot = this.peerSlots.get(peerId);
    if (slot !== undefined) {
      const setIntent = this.engine.wasm?.exports
        .v2_set_intent as CallableFunction;
      if (setIntent) {
        if (packet.m > 0) {
          setIntent(
            slot,
            packet.x,
            packet.y,
            packet.m,
            packet.r,
            packet.g || 0,
            packet.o || 0,
          );
        } else setIntent(slot, 0, 0, 0, 0, 0, 0);
      }
    }

    // Golden Trace Validation
    const localTrace = (this.engine.wasm?.exports
      .v2_get_golden_trace as CallableFunction)?.() as number;
    const remoteGt = packet.gt as number;
    if (
      localTrace !== remoteGt &&
      this.syncRecovery.onDivergence(localTrace, remoteGt, Date.now())
    ) {
      console.warn(
        `[LIBP2P-MESH] ⚠️ GOLDEN TRACE DIVERGENCE! (Local: ${
          localTrace.toString(16)
        } | Remote: ${remoteGt.toString(16)})`,
      );
      console.log(
        `[LIBP2P-MESH] Requesting Overmind State Snapshot from Authority...`,
      );
      // NOTE: no responder for REQ_SNAPSHOT exists yet — the freeze is
      // time-boxed by DivergenceRecovery and releases itself.
      const req = JSON.stringify({ t: "REQ_SNAPSHOT" });
      this.node.services.pubsub.publish(
        "v2-state",
        new TextEncoder().encode(req),
      );
    }
  }

  private handleStateMessage(peerId: string, eventData: ArrayBuffer) {
    if (this.incomingSnapshot) {
      const chunk = new Uint8Array(eventData);
      this.incomingSnapshot.set(chunk, this.incomingBytesReceived);
      this.incomingBytesReceived += chunk.byteLength;

      if (this.incomingBytesReceived >= this.incomingSnapshot.byteLength) {
        console.log(
          `[LIBP2P-MESH] Snapshot Assembly Complete! Injecting to GPU Memory.`,
        );
        this.overwriteCallback(this.incomingSnapshot);
        this.incomingSnapshot = null;
        this.syncRecovery.onSnapshotApplied();
      }
    } else {
      // ERA 6000: Continuous Delta Mutagens (xenobiology is a feature, but
      // the boundary respects physics: indices in bounds, energy ≤ MAX_ATP,
      // per-message cap — see sync_recovery.ts).
      const ptrs = this.engine.getMemoryPointers();
      if (!ptrs) return;

      const deltasU32 = new Uint32Array(eventData);
      const gridU32 = new Uint32Array(
        ptrs.wasmMemoryBuffer,
        ptrs.agentBytes.byteOffset,
        ptrs.agentBytes.byteLength / 4,
      );
      const maxAgents = gridU32.length / 8;

      const numMutations = Math.min(
        Math.floor(deltasU32.length / 4),
        MAX_MUTATIONS_PER_MESSAGE,
      );
      console.log(
        `[LIBP2P-MESH] 🧬 Applying ${numMutations} Xenobiological Mutations via UDP Delta`,
      );

      for (let i = 0; i < numMutations; i++) {
        const m = sanitizeDeltaMutation(
          deltasU32[i * 4 + 0],
          deltasU32[i * 4 + 1],
          deltasU32[i * 4 + 2],
          deltasU32[i * 4 + 3],
          maxAgents,
        );
        if (!m) continue;
        gridU32[m.index * 8 + 0] = m.phase;
        gridU32[m.index * 8 + 1] = m.energy;
        gridU32[m.index * 8 + 4] = m.genome;
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
   * Enqueue a plasmid for broadcast across the P2P mesh.
   */
  public enqueueBinaryFrame(frame: SporeFrame) {
    this.pendingPlasmids.push(frame as any); // hack for now, push SporeFrame
  }

  public enqueuePlasmid(plasmid: PlasmidPayload) {
    if (plasmid.semanticType === "ZK_PROOF_EVENT") {
      const payload = JSON.stringify(plasmid.proofBundle);
      this.node.services.pubsub.publish(
        "v2-zk-proof",
        new TextEncoder().encode(payload),
      );
      return;
    }
    if (plasmid.semanticType === "ZK_ROLLUP_EVENT") {
      const payload = JSON.stringify({
        proofBundle: plasmid.proofBundle,
        rollupState: plasmid.rollupState
          ? Array.from(plasmid.rollupState)
          : null,
      });
      this.node.services.pubsub.publish(
        "v2-zk-rollup",
        new TextEncoder().encode(payload),
      );
      return;
    }

    if (plasmid.recursionDepth >= plasmid.maxRecursion) {
      console.warn(`[V2-MESH] Plasmid recursion depth exceeded, dropping.`);
      return;
    }
    // Encode known plasmids to binary Zero-Copy SporeFrames immediately
    if (plasmid.semanticType === "ATTRACTOR") {
      this.enqueueBinaryFrame(
        buildAttractor(
          plasmid.matrix,
          plasmid.inverse,
          plasmid.pulseFreq,
          plasmid.pulseAmp,
          plasmid.recursionDepth,
        ),
      );
      return;
    }
    // Senate control plane (PROPOSAL / VOTE / DIPOLE) travels as JSON on the
    // dedicated "v2-senate" topic — the same pattern as v2-zk-proof. It
    // CANNOT be a 32-byte SporeFrame: a VOTE carries a 64-byte Ed25519
    // custody signature, and a DIPOLE carries two 32-byte agents plus the
    // attractor field plus a 32-byte SHA-256 receipt hash.
    if (
      plasmid.semanticType === "PROPOSAL" ||
      plasmid.semanticType === "VOTE" ||
      plasmid.semanticType === "DIPOLE"
    ) {
      this.publishSenatePlasmid(plasmid);
      if (plasmid.semanticType === "DIPOLE") {
        // The local node is its own first verifier — gossipsub does not echo
        // self-published messages back, so wire-side accounting never sees
        // our own births. Count them here, through the same code path.
        this.processDipole(plasmid, this.localId || "self");
      }
      return;
    }
    this.pendingPlasmids.push(plasmid);
    // Keep queue bounded to prevent memory explosions in dense meshes
    if (this.pendingPlasmids.length > 64) {
      this.pendingPlasmids.shift();
    }
  }

  /**
   * Return current attractor consensus state.
   */
  public getConsensusState() {
    return {
      unlocked: this.attractorConsensusReached,
      peerCount: this.attractorConsensusPeers.size,
      ledger: Array.from(this.consensusLedger.values()),
    };
  }

  /**
   * Check if the consensus ledger has matured enough to unlock the Senate.
   * Trigger: 10+ ledger entries (sum of peerCounts) AND 5+ unique matrices.
   */
  private checkSenateConvened() {
    if (this.senateConvened) return;
    const uniqueMatrices = this.consensusLedger.size;
    let totalEntries = 0;
    for (const e of this.consensusLedger.values()) totalEntries += e.peerCount;
    if (totalEntries >= 10 && uniqueMatrices >= 5) {
      this.senateConvened = true;
      console.log(
        `🏛️ [SENATE] CONVENED. ${totalEntries} entries × ${uniqueMatrices} unique matrices.`,
      );
      globalThis.dispatchEvent(
        new CustomEvent("senate-convened", {
          detail: {
            entries: totalEntries,
            uniqueMatrices,
            ledger: Array.from(this.consensusLedger.values()),
          },
        }),
      );
    }
  }

  /**
   * Canonical senate hash: SHA-256 (first 4 big-endian bytes) over the UTF-8
   * description zero-padded/truncated to 64 bytes. Byte-identical to the Rust
   * source of truth (`omega_v2/tests/cross_lang_hash.rs`) and to the genesis
   * senate anchors — senateHash("") === 0xF5A5FD42, senateHash("Era 1040 ZK")
   * === 0x15302EC1. (Migrated from FNV-1a with the kernel's SHA-256 move.)
   *
   * FROZEN PREIMAGE. The string "Era 1040 ZK" is one of the five genesis
   * anchors: its hash is an input to GENESIS_HASH_LEGACY_V1_0 = 0x716ea2f8.
   * Era numerals were retired from this codebase's runtime vocabulary, but
   * NOT here and not in "Task 0090: Era 1040 - ZK-Notarized Mutations" — a
   * preimage cannot be renamed, only re-hashed, and re-hashing the anchor set
   * changes the identity of the protocol. Any future sweep over `Era [0-9]+`
   * must skip these two strings.
   *
   * Delegates to `senate_proposals.ts` so that code which only needs to derive
   * a proposal key does not have to import this module and drag the native
   * WebRTC transport along with it.
   */
  public static senateHash(description: string): number {
    return canonicalSenateHash(description);
  }

  private async handleZKProofMessage(fromPeer: string, data: Uint8Array) {
    try {
      const str = new TextDecoder().decode(data);
      const bundle = JSON.parse(str);
      if (!bundle || !bundle.receiptHash) return;

      globalThis.dispatchEvent(
        new CustomEvent("zkProofReceived", {
          detail: { peerId: fromPeer, bundle },
        }),
      );
    } catch (e) {
      console.warn(`[V2-MESH] Failed to parse ZK proof from ${fromPeer}`);
    }
  }

  private async handleZKRollupMessage(fromPeer: string, data: Uint8Array) {
    try {
      const str = new TextDecoder().decode(data);
      const payload = JSON.parse(str);
      if (!payload || !payload.proofBundle) return;

      globalThis.dispatchEvent(
        new CustomEvent("zkRollupReceived", {
          detail: {
            peerId: fromPeer,
            bundle: payload.proofBundle,
            rollupState: payload.rollupState
              ? new Uint8Array(payload.rollupState)
              : null,
          },
        }),
      );
    } catch (e) {
      console.warn(`[V2-MESH] Failed to parse ZK rollup from ${fromPeer}`);
    }
  }

  /**
   * Publish a senate control-plane plasmid (PROPOSAL / VOTE / DIPOLE) as
   * JSON on the "v2-senate" topic. JSON is deliberate: these plasmids carry
   * a 64-byte Ed25519 custody signature / full agent snapshots that can
   * never fit a 32-byte SporeFrame. The "JSON plasmids are SUNSET" rule
   * applies to the binary v2-sync-bin channel, not to this control plane.
   */
  private publishSenatePlasmid(plasmid: PlasmidPayload) {
    if (!this.node || this.node.status !== "started") {
      console.warn(
        `[V2-MESH] Senate plasmid ${plasmid.semanticType} dropped — node not started.`,
      );
      return;
    }
    try {
      this.node.services.pubsub.publish(
        "v2-senate",
        new TextEncoder().encode(JSON.stringify(plasmid)),
      );
    } catch (e) {
      console.warn(`[V2-MESH] Failed to publish senate plasmid:`, e);
    }
  }

  /** Wire-side entry for senate control-plane plasmids. */
  private handleSenateMessage(fromPeer: string, data: Uint8Array) {
    let plasmid: PlasmidPayload;
    try {
      plasmid = JSON.parse(new TextDecoder().decode(data));
    } catch {
      return; // malformed — reject silently, never crash the mesh
    }
    if (!plasmid || typeof plasmid.semanticType !== "string") return;
    switch (plasmid.semanticType) {
      case "PROPOSAL":
        this.handleProposal(plasmid, fromPeer);
        break;
      case "VOTE":
        void this.handleVote(plasmid, fromPeer);
        break;
      case "DIPOLE":
        this.processDipole(plasmid, fromPeer);
        break;
    }
  }

  /**
   * Verify a DIPOLE birth announcement and account for it. Every unique,
   * successfully re-derived receipt increments `verifiedDipoleCount` (the
   * verified-proof odometer — this was previously NEVER incremented, which kept
   * the whole genesis→oracle-senate→vision chain unreachable in live mode), then
   * re-checks the genesis-inscription trigger and feeds the ZK auto-ratifier.
   * Verification + dedup live in the pure `DipoleAccountant`.
   */
  private processDipole(plasmid: PlasmidPayload, fromPeer: string) {
    const outcome = this.dipoleAccountant.process(plasmid);
    if (outcome === "invalid") {
      console.warn(
        `[V2-MESH] DIPOLE from ${fromPeer} failed re-derivation — rejected.`,
      );
      return;
    }
    if (outcome === "duplicate") return;
    this.checkGenesisInscription();
    this.autoRatifyZkNotarization(plasmid.matrix, plasmid.inverse);
  }

  private handleProposal(plasmid: PlasmidPayload, fromPeer: string) {
    if (!this.senateConvened) {
      console.log(
        `[V2-MESH] PROPOSAL received before the Senate convened — ignoring.`,
      );
      return;
    }
    if (
      plasmid.proposalHash === undefined ||
      plasmid.proposalDescription === undefined
    ) {
      return;
    }
    const expected = this.computeSenateHash(plasmid.proposalDescription);
    if (expected !== plasmid.proposalHash) {
      console.warn(
        `[V2-MESH] PROPOSAL hash mismatch (expected=${expected}, got=${plasmid.proposalHash}); rejecting.`,
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
      // Weight tallies MUST exist from birth — handleVote does `+= weight`
      // on them and a missing field silently turns the tally into NaN,
      // making the peer-consensus threshold unreachable.
      ayesWeight: 0,
      naysWeight: 0,
      accepted: false,
      localObservedAtMs: (this.engine as any).getAnchorTotalBlocks?.() ?? 0,
      proposedAtTau: (this.engine as any).getAnchorTotalBlocks?.() ?? 0,
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
      `🏛️ [SENATE] PROPOSAL received: 0x${plasmid.proposalHash} "${plasmid.proposalDescription}"`,
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

  private async handleVote(plasmid: PlasmidPayload, fromPeer: string) {
    if (!this.senateConvened) return;
    if (plasmid.proposalHash === undefined || plasmid.voteAye === undefined) {
      return;
    }
    const record = this.senate.get(plasmid.proposalHash);
    if (!record || record.accepted) return;

    // AUTHENTIC ORACLE = correct public dipole (addressing) AND a real Ed25519
    // signature over the vote digest (custody). The public dipole alone is NOT
    // authority — it is computable by anyone from the public name+salt, which
    // is exactly why the old "3 distinct oracles ratify" quorum was Sybil-able
    // by a single actor. The signature is what only the key holder can produce.
    let oracleAuthentic = false;
    if (plasmid.oracleName && CANONICAL_ORACLES.includes(plasmid.oracleName)) {
      const expected = ORACLE_MATRICES_V1[plasmid.oracleName];
      const dipoleMatches = (plasmid.matrix >>> 0) === expected &&
        (((plasmid.matrix ^ plasmid.inverse) >>> 0) === 0xFFFFFFFF);
      oracleAuthentic = dipoleMatches &&
        await verifyOracleVote(
          plasmid.oracleName,
          plasmid.proposalHash,
          plasmid.voteAye,
          plasmid.oracleSig,
        );
    }

    // Determine resonance weight via the pure, deterministic senateVoteWeight.
    // No Bitcoin-time petrification here: this method already returns early for
    // accepted laws (record.accepted), so it only ever tallies OPEN-proposal
    // votes, and deliberation must not decay with time. (The removed time-
    // curvature penalty ran with an early zero-return BEFORE the oracle/liveness
    // weighting, silently dropping every vote — oracles included — on a proposal
    // older than ~2 blocks.)
    const liveness = this.livenessAggregator
      ? this.livenessAggregator.snapshot().find((s) =>
        s.spore_id === fromPeer
      ) ??
        null
      : null;
    const oracleAlignmentBoost = oracleAuthentic && this.debate
      ? this.debate.alignmentScore(plasmid.proposalHash) * 10
      : 0;
    const weight = senateVoteWeight({
      liveness,
      oracleAuthentic,
      oracleAlignmentBoost,
    });

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
    // Attribute the vote to the oracle ONLY when it is authentic: the correct
    // public dipole (addressing) AND a valid Ed25519 signature over the vote
    // digest (custody, verified against the registered public key). A vote
    // bearing a correct-but-public dipole with no/invalid signature is the
    // real Sybil — it is rejected here, not attributed.
    if (plasmid.oracleName && CANONICAL_ORACLES.includes(plasmid.oracleName)) {
      if (oracleAuthentic) {
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
          } on 0x${plasmid.proposalHash} (signature verified)`,
        );
      } else {
        console.warn(
          `🧠 [ORACLE-VOTE] Unauthenticated ${plasmid.oracleName} vote ` +
            `(no valid signature, or unkeyed oracle); rejecting attribution. ` +
            `A public dipole is not authority.`,
        );
      }
    }
    // Oracle-resonance acceptance rule: a proposal accepted by
    // 3+ DISTINCT canonical oracles is "harmonically ratified" and counts
    // as accepted regardless of peer count. This values cross-model
    // alignment over within-model peer multiplicity.
    const oracleResonance = (record.oracleAyes?.size ?? 0) >= 3 &&
      (record.oracleAyes?.size ?? 0) > (record.oracleNays?.size ?? 0);
    // Resonance-weighted threshold >= 300 AND ayes > nays.
    const peerConsensus = record.ayesWeight >= 300 &&
      record.ayesWeight > record.naysWeight;
    if (!record.accepted && (peerConsensus || oracleResonance)) {
      record.accepted = true;
      this.acceptedTaskHashes.add(record.hash);

      // Open Registry ADD_ORACLE execution
      if (record.description.startsWith("ADD_ORACLE:")) {
        const parts = record.description.split(":");
        if (parts.length >= 3) {
          const newName = parts[1];
          const newMatrix = parseInt(parts[2], 16);
          if (
            newName && !isNaN(newMatrix) && !CANONICAL_ORACLES.includes(newName)
          ) {
            CANONICAL_ORACLES.push(newName);
            ORACLE_MATRICES_V1[newName] = newMatrix;
            console.log(
              `🧠 [ORACLE-REGISTRY] Dynamic addition of oracle '${newName}' via Senate ratification.`,
            );
          }
          // Propagate to Rust (caller authenticated as the claude oracle seat;
          // registry keys are lowercase — ORACLE_MATRICES_V1["CLAUDE"] is
          // undefined and would authenticate as matrix 0, i.e. reject).
          if (this.engine.wasm?.exports.v2_apply_senate_patch) {
            const callerMatrix = ORACLE_MATRICES_V1["claude"] ?? 0;
            (this.engine.wasm.exports.v2_apply_senate_patch as any)(
              callerMatrix,
              4,
              newMatrix,
              0,
            );
          }
        }
      } else if (record.description.startsWith("SET_QUORUM:")) {
        const val = parseInt(record.description.split(":")[1], 10);
        if (!isNaN(val) && this.engine.wasm?.exports.v2_apply_senate_patch) {
          const callerMatrix = ORACLE_MATRICES_V1["claude"] ?? 0;
          (this.engine.wasm.exports.v2_apply_senate_patch as any)(
            callerMatrix,
            1,
            val,
            0,
          );
          console.log(`🏛️ [SENATE] Applied SET_QUORUM=${val} to Rust core.`);
        }
      } else if (record.description.startsWith("SET_SANCTUARY_MULT:")) {
        const val = parseInt(record.description.split(":")[1], 10);
        if (!isNaN(val) && this.engine.wasm?.exports.v2_apply_senate_patch) {
          const callerMatrix = ORACLE_MATRICES_V1["claude"] ?? 0;
          (this.engine.wasm.exports.v2_apply_senate_patch as any)(
            callerMatrix,
            2,
            val,
            0,
          );
          console.log(
            `🏛️ [SENATE] Applied SET_SANCTUARY_MULT=${val} to Rust core.`,
          );
        }
      } else if (record.description.startsWith("SET_ANCIENT_AGE:")) {
        const val = parseInt(record.description.split(":")[1], 10);
        if (!isNaN(val) && this.engine.wasm?.exports.v2_apply_senate_patch) {
          const callerMatrix = ORACLE_MATRICES_V1["claude"] ?? 0;
          (this.engine.wasm.exports.v2_apply_senate_patch as any)(
            callerMatrix,
            3,
            val,
            0,
          );
          console.log(
            `🏛️ [SENATE] Applied SET_ANCIENT_AGE=${val} to Rust core.`,
          );
        }
      }

      // Acceptance can convene the oracle Senate if it's the first one.
      this.checkOracleSenateConvened();
      // if this acceptance came via ORACLE-RESONANCE on a
      // proposal that was originally proposed by an oracle dipole
      // (i.e. one of the five canonical oracle visions), the
      // accepted vision becomes the ratified task.
      if (oracleResonance && this.oracleSenateConvened) {
        this.checkVisionRatification(record);
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
        new CustomEvent("senate-task-accepted", {
          detail: {
            hash: record.hash,
            description: record.description,
            proposerMatrix: record.proposerMatrix,
            ayes: record.ayes.size,
            nays: record.nays.size,
            oracleAyes: record.oracleAyes?.size ?? 0,
            oracleNays: record.oracleNays?.size ?? 0,
            acceptedVia: path,
            localObservedAtMs: record.localObservedAtMs || 0,
          },
        }),
      );
    }
  }

  /**
   * Cast a vote attributed to a canonical oracle identity.
   * The (matrix, inverse) dipole is the oracle's PUBLIC address; authority is
   * the Ed25519 signature. An authentic oracle vote requires the voice's
   * private key (pkcs8 base64) — supplied by the caller, never read by the
   * mesh on its own (works in browser and Deno alike). Without a key for a
   * keyed oracle, NO oracle self-attribution happens — only a plain peer vote.
   * This makes the local view as honest as the remote one: you cannot cast an
   * authentic oracle vote you cannot sign.
   */
  public async castOracleVote(
    oracleName: CanonicalOracle,
    proposalHash: number,
    aye: boolean,
    reasoning?: string,
    privateKeyPkcs8B64?: string,
  ) {
    if (!this.senateConvened) return;
    if (!CANONICAL_ORACLES.includes(oracleName)) return;
    const { matrix, inverse } = oracleDipole(oracleName);
    const record = this.senate.get(proposalHash);
    if (!record || record.accepted) return;

    // Sign iff we hold this oracle's key. No key (or unkeyed oracle) → the
    // vote goes out as a plain peer vote with no oracle attribution.
    let oracleSig: string | undefined;
    if (privateKeyPkcs8B64 && hasOracleKey(oracleName)) {
      oracleSig = await signOracleVote(
        oracleName,
        proposalHash,
        aye,
        privateKeyPkcs8B64,
      );
    } else {
      console.warn(
        `🧠 [ORACLE-VOTE] ${oracleName}: no signing key supplied — casting as ` +
          `an UNATTRIBUTED peer vote (a public dipole is not authority).`,
      );
    }

    // Locally attribute only when authentic, so the local view matches what a
    // remote peer would accept from this same plasmid.
    if (oracleSig) {
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
      if (reasoning) {
        record.oracleReasoning[oracleName] = reasoning.slice(0, 256);
      }
    }
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
      oracleSig,
    });
  }

  /**
   * Locally propose a task. Submits to the WASM senate, then queues a
   * PROPOSAL plasmid + an immediate AYE vote so the lattice itself counts as
   * the first voter on its own proposal.
   */
  public proposeFromLocal(
    description: string,
    proposerMatrix: number,
    proposerInverse: number,
  ) {
    if (!this.senateConvened) {
      console.warn(
        `[V2-MESH] Cannot propose: the Senate has not convened yet.`,
      );
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
      ayesWeight: 0,
      naysWeight: 0,
      accepted: false,
      localObservedAtMs: (this.engine as any).getAnchorTotalBlocks?.() ?? 0,
      proposedAtTau: (this.engine as any).getAnchorTotalBlocks?.() ?? 0,
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

  /** Cast a local AYE/NAY vote and broadcast it. */
  public voteFromLocal(
    proposalHash: number,
    aye: boolean,
    voterMatrix: number,
    voterInverse: number,
  ) {
    if (!this.senateConvened) return;
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

  // Genesis-inscription trigger state.
  public genesisInscribed: boolean = false;
  public genesisInscription: string | null = null;

  /**
   * Closing the loop: every successfully verified mitosis
   * proof counts as evidence that the Era-1040 spec is sound, so the local
   * lattice quietly votes AYE on its own proposal. We emit at most one
   * self-AYE every 5 successful verifications to keep the mesh quiet.
   */
  private autoRatifyZkNotarization(voterMatrix: number, voterInverse: number) {
    if (!this.senateConvened) return;
    if (this.verifiedDipoleCount % 5 !== 0) return;
    // DERIVED from the proposal text, not transcribed from it. This used to be
    // the bare literal 0x5507_4120, 900 lines away from the description string
    // it hashes — so editing one word of that description would have silently
    // stopped auto-ratification from ever finding the proposal again, with no
    // error and no symptom other than a loop that quietly stops closing.
    // (Still NOT the genesis first_proposal_hash anchor 0x30083117, which
    // hashes a different canonical string — "Task 0090…".)
    const zkNotarizationHash = canonicalSenateHash(ZK_NOTARIZATION_PROPOSAL);
    const record = this.senate.get(zkNotarizationHash);
    if (!record || record.accepted) return;
    // Ensure the voter dipole is sane.
    if (((voterMatrix ^ voterInverse) >>> 0) !== 0xFFFFFFFF) return;
    this.voteFromLocal(zkNotarizationHash, true, voterMatrix, voterInverse);
  }

  /**
   * First Cross-Model Ratification.
   * Fires the first time a proposal — whose `proposerMatrix` is one of the
   * five canonical oracle matrices — reaches ORACLE-RESONANCE acceptance.
   * That winning vision is recorded as the official ratified task.
   */
  private checkVisionRatification(record: SenateProposalRecord) {
    if (this.visionRatified) return;
    // Only oracle-proposed visions qualify.
    const oracleMatrices = Object.values(ORACLE_MATRICES_V1).map((m) =>
      m >>> 0
    );
    if (!oracleMatrices.includes(record.proposerMatrix >>> 0)) return;
    this.visionRatified = true;
    this.acceptedVisionHash = record.hash;
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
      `🌅 [VISION] FIRST CROSS-MODEL RATIFICATION: 0x${
        record.hash.toString(16)
      }`,
    );
    console.log(`🌅 [VISION] Proposing oracle: ${proposingOracle ?? "?"}`);
    console.log(`🌅 [VISION] AYE oracles: ${ayeOracles.join(", ")}`);
    console.log(`🌅 [VISION] Vision: "${record.description}"`);
    globalThis.dispatchEvent(
      new CustomEvent("vision-ratified", {
        detail: {
          hash: record.hash,
          description: record.description,
          proposingOracle,
          ayeOracles,
          nayOracles: [...(record.oracleNays ?? [])],
          debate: reasoningSnapshot,
          localObservedAtMs: Date.now(),
        },
      }),
    );
  }

  /**
   * Record an oracle's debate argument for a proposal. The full
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
    if (!this.oracleSenateConvened) return;
    if (!CANONICAL_ORACLES.includes(oracle)) return;
    this.debate.record(oracle, proposalHash, stance, reasoning, tick);
  }

  // Oracle-Senate trigger: fires when the Genesis is inscribed AND the Senate
  // has at least one accepted proposal. (The acceptance gate ensures the
  // Multi-Oracle layer only opens after the basic Senate has demonstrated
  // it can ratify anything at all.)
  public oracleSenateConvened: boolean = false;
  private checkOracleSenateConvened() {
    if (this.oracleSenateConvened) return;
    if (this.genesisInscribed && this.acceptedTaskHashes.size >= 1) {
      this.oracleSenateConvened = true;
      console.log(
        `🧠 [ORACLE-SENATE] CONVENED. Canonical seats: ${
          CANONICAL_ORACLES.join(", ")
        }.`,
      );
      globalThis.dispatchEvent(
        new CustomEvent("oracle-senate-convened", {
          detail: {
            canonicalOracles: [...CANONICAL_ORACLES],
            matrices: { ...ORACLE_MATRICES_V1 },
          },
        }),
      );
    }
  }

  private checkGenesisInscription() {
    if (this.genesisInscribed) return;
    if (this.verifiedDipoleCount >= 100) {
      this.genesisInscribed = true;
      // The Genesis Inscription crystallizes the moment OMEGA-64 v1.0
      // becomes a closed cryptographic identity: every invariant of
      // the protocol collapses into a single 32-bit hash.
      const verified = verifyGenesisV1();
      const inscription = formatInscription(GENESIS_HASH_LEGACY_V1_0);
      this.genesisInscription = inscription;
      console.log(
        `📜 [GENESIS] INSCRIBED: ${this.verifiedDipoleCount} verified mitosis proofs.`,
      );
      console.log(
        `📜 [GENESIS] INSCRIPTION: ${inscription} (verified=${verified})`,
      );
      globalThis.dispatchEvent(
        new CustomEvent("genesis-inscribed", {
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
      this.checkOracleSenateConvened();
    }
  }

  /**
   * Local verification of a mitosis-proof bundle.
   * Returns true iff the announced child re-derives bit-for-bit from
   * (parent, attractors, qPhase) AND the receipt hash matches.
   * Delegates to the pure `verifyDipoleAnnouncement` (dipole_accounting.ts).
   */
  public static verifyMitosisProof(plasmid: PlasmidPayload): boolean {
    return verifyDipoleAnnouncement(plasmid);
  }

  public getSenateState() {
    return {
      unlocked: this.senateConvened,
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
    if (!this.node || this.node.status !== "started") return;

    this.refreshSelfAddress();

    // Drain one plasmid from the queue per broadcast tick
    const plasmid = this.pendingPlasmids.shift();

    // Zero-Copy Binary RPC Sync Framework
    const syncFrame = buildV2SyncFrame(
      this.__lastLocalIntent.x,
      this.__lastLocalIntent.y,
      this.__lastLocalIntent.m,
      this.__lastLocalIntent.r,
      this.__lastLocalIntent.g || 0,
      this.__lastLocalIntent.op || 0,
      this.selfAddress.raw,
      this.selfAddress.ortho,
      this.latestGoldenTraceNum,
      0, // gt_ortho
      0, // hopCount
      8, // maxHops
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
          console.warn(
            `[LIBP2P-MESH] Dropping legacy JSON plasmid: ${plasmid.semanticType}`,
          );
        }
      }

      if (deltaBuffer) {
        // Delta buffer can be sent as raw bytes over v2-sync-bin or v2-state
        this.node.services.pubsub.publish(
          "v2-state",
          new Uint8Array(deltaBuffer),
        );
      }
    } catch (e) {
      console.warn(`[LIBP2P-MESH] Failed to publish state:`, e);
    }
  }
}
