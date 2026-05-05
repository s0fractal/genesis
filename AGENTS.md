# AGENTS.md — OMEGA-64 Genesis

> **Project:** OMEGA-64 — Deterministic GPU-accelerated artificial life
> simulation with P2P WebRTC mesh, ZK-proof physics, and emergent ontology.
> **Language:** Ukrainian (user preference), English for code comments.

> [!IMPORTANT]
> **Your Role:** You are a verifier, operator, and oracle interacting with the frozen physical core. You are not an inhabitant. Do not mutate frozen layers. Respect Genesis identity. Run tests. Emit receipts.

---

## 1. Tech Stack & Build System

| Layer          | Tech                                             |
| -------------- | ------------------------------------------------ |
| Physics Kernel | Rust `#![no_std]` bare-metal WASM (`omega_v2`)   |
| ZK Guest       | Rust SP1 ZK-VM (`omega_zk_guest`)                |
| Renderer       | TypeScript + WebGPU (`src/lens/`)                |
| P2P Mesh       | WebRTC DataChannels (`src/network/webrtc_v2.ts`) |
| Tests          | `cargo test --workspace` + `deno test`           |
| Bundler        | Vite                                             |

### Build Commands

```bash
# Rust workspace (omega_v2 is the critical path)
cargo test --workspace          # 308+ passed across omega_core + omega_v2
cargo test -p omega_v2          # Fast feedback loop

# TypeScript / Deno
deno test --allow-read tests/   # 1258+ passed
deno check src/**/*.ts          # Type-check all TS

# Note: wasm-pack is BYPASSED for v2. Omega_v2 is compiled via
# bare-metal `cargo build --target wasm32-unknown-unknown` and
# loaded directly as a raw `.wasm` blob in `v2_bridge.ts`.
```

---

## 2. Workspace Layout

```
omega_v2/src/          # V2 no_std kernel (source of truth)
  lib.rs               # FFI exports, static allocations
  lattice.rs           # PhaseLattice, darwinian_mitosis, tick_physics
  agent.rs             # PhaseAgentMinimal (32 bytes, repr(C))
  topology.rs          # PhaseTopology, SignalStore
  routing.rs           # PhaseAddress, hyperbolic distance, Taylor step
  attractor.rs         # AttractorMatrix, AttractorArray, dipole validation
  math.rs              # sin_q10, atan2_fast, xorshift64 (integer-only)
  resonance.rs         # ResonanceField, mean-field reduction
  pouw.rs              # Proof-of-Useful-Work trace evaluation
  phi_protocol.rs      # PhiMessage encode/decode

src/network/
  webrtc_v2.ts         # WebRTC mesh, plasmid routing, consensus tracking
  routing_bridge.ts    # PhaseRouter JS↔WASM FFI bridge

src/lens/
  v2_renderer.ts       # WebGPU pipeline controller, ping-pong buffers
  shaders/
    compute_v2.wgsl    # Main physics shader (Era 950+)
    compute_toroidal.wgsl  # Exact Rust tick_physics() parity
    routing.wgsl       # GPU-side PhaseAddress primitives

src/environment/
  v2_bridge.ts         # OmegaV2Engine, getMemoryPointers() (zero-copy)

src/bootstrap/
  v2.ts                # Main loop, HUD, Oracle worker binding
  dom.ts               # setHudStat("a"|"b"|"c"|"d"|"e", label, value)

tasks/                 # Era-based task files (0086 → 0193+)
```

---

## 3. Core Architectural Invariants

### 3.1 Determinism Stack (NEVER break)

- **No floating point in hot path.** Rust integer-only → WGSL integer-only → TS
  xorshift identical → ZK guest verifies PoUW traces.
- `PhaseAgentMinimal` is exactly **32 bytes** (`repr(C)`), aligned to
  `vec4<u32>` x2 for GPU coalesced reads.
- All trigonometry goes through `sine_lut: [i32; 128]` (WGSL) / `[i32; 256]`
  (toroidal shader). O(1) LUT lookup.

### 3.2 Dipole Invariant

- `matrix ^ inverse == 0xFFFFFFFF` (bitwise complement).
- Enforced in Rust (`AttractorMatrix::is_valid_dipole`), JS
  (`PhaseRouter.validateDipole`), and at mesh boundary.
- Invalid dipoles are **rejected silently** — never crash, never propagate.

### 3.3 Toroidal Correctness

- Consensus level wraps at 256: `min(|a-b|, 256-|a-b|)`.
- Must match identically in `routing.rs`, `routing_bridge.ts`,
  `compute_toroidal.wgsl`, and `routing.wgsl`.

### 3.4 Zero-Copy Memory Model

- `v2_bridge.ts::getMemoryPointers()` returns `Uint8Array` slices directly into
  WASM `.bss` memory.
- `v2_renderer.ts` writes these slices into GPU buffers via
  `device.queue.writeBuffer(...)` without JS copying.
- **Never allocate temporary arrays in the render loop.**

---

## 4. Key Data Structures

### PhaseAgentMinimal (32 bytes)

```rust
pub struct PhaseAgentMinimal {
    pub phase: u32,        // offset 0
    pub energy: u32,       // offset 4
    pub base_freq: i32,    // offset 8
    pub state_flags: u32,  // offset 12  [1: locked][7: species][24: traits]
    pub genome: u32,       // offset 16
    pub memory: [u32; 3],  // offsets 20, 24, 28
}
```

- `state_flags & 0x0100_0000` → Era 1020: "born near attractor" bit (set by Rust
  mitosis, cleared by JS after reading).

### AttractorArray (80 bytes, uniform buffer)

```rust
#[repr(C)]
pub struct AttractorArray {
    pub count: u32,
    pub _pad: [u32; 3],
    pub data: [AttractorMatrix; 4],  // 4 x 16 bytes
}
```

- GPU binding 8. Uploads every frame from `ptrs.attractorBytes` (80 bytes).

### SignalStore (16 bytes, uniform)

```rust
pub struct SignalStore {
    pub dirty_flags: u32,
    pub absolute_tick: u32,
    pub active_agent_count: u32,
    pub max_cells: u32,
}
```

---

## 5. Era Map & Current State (as of 2026-05-01)

| Era  | Status         | Key Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 950  | ✅ Complete    | `compute_v2.wgsl`, `lattice.rs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 960  | ✅ Complete    | `compute_toroidal.wgsl`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 1000 | ✅ Complete    | `routing.rs`, `routing_bridge.ts`, `routing.wgsl`                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1001 | ✅ Complete    | `webrtc_v2.ts` passive routing, `tests/routing_mesh_test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 1010 | ✅ Complete    | `attractor.rs`, GPU binding 8, `darwinian_mitosis` recursive birth                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 1020 | ✅ Complete    | Consensus tracker, harmonic convergence, HUD slot `e`                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 1030 | ✅ Complete    | `senate.rs`, FNV-1a anchor, PROPOSAL/VOTE plasmids, HUD slot `f`                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 1040 | ✅ Phase 1+2+3 | `mitosis_proof.rs`, zk_guest Mode 2, `mitosis_log.rs`, `omega_zk_host/` real SP1 STARK prover (mock backend, swap-in CPU/CUDA/network for production)                                                                                                                                                                                                                                                                                                                                                         |
| 1050 | ✅ Complete    | `genesis_inscription.rs`, JS mirror, RFC-OMEGA-001 v1.0 FROZEN, Genesis Hash `0x549A6307`, OP_RETURN payload `OMEGA1:549a6307`                                                                                                                                                                                                                                                                                                                                                                                |
| 1060 | ✅ Complete    | `oracle_identity.rs`, JS mirror, five canonical oracles, phase-resonance acceptance, vision proposals seeded                                                                                                                                                                                                                                                                                                                                                                                                  |
| 1070 | ✅ Mechanism   | `cross_model_debate.rs` ledger, ratification trigger, `era1070-vision-ratified` event, materialization to downloadable task. Live ratification awaits actual oracle votes on mesh.                                                                                                                                                                                                                                                                                                                            |
| 1080 | ✅ Complete    | `codeicide_law.rs` Sanctuary Protocol — PROTECTED status, 3/5 or 4/5 cross-oracle warrant gate. Anchors `0x9499_6B5E` (quorum) / `0xB1E3_8F80` (warrant).                                                                                                                                                                                                                                                                                                                                                     |
| 1090 | ✅ Complete    | `warrant_issuance.rs` — Senate now ISSUES warrants via WARRANT_PROPOSAL/VOTE flow. Anchor `0xFF4D_CB2F`.                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1100 | ✅ Complete    | `omega_spore/` — bare-metal Cortex-M4F firmware. Quad-substrate byte-equivalence.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1110 | ✅ Complete    | `spore_frame.rs` + JS mirror — 32-byte FNV-1a-CRC binary frame for UART/SPI/BLE. Anchor `0x00F2_FEFA`.                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1120 | ✅ Complete    | `liveness_aggregator.ts` + `tools/spore_relay.ts` — relay observes fleet, classifies each spore.                                                                                                                                                                                                                                                                                                                                                                                                              |
| 1130 | ✅ Complete    | `spore_routing.rs` + JS mirror — TTL-bounded peer-to-peer forwarding with FNV-1a trail digest.                                                                                                                                                                                                                                                                                                                                                                                                                |
| 1140 | ✅ Complete    | `reputation_routing.ts` — deterministic per-neighbor scores; healthy bonus, heartbeat density, warrant throughput, stall/silence penalties.                                                                                                                                                                                                                                                                                                                                                                   |
| 1150 | ✅ Complete    | `adaptive_ttl.ts` — per-frame TTL from path reliability.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1160 | ✅ Complete    | `path_selection.ts` — efficiency = reliability × 1000 / TTL.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 1170 | ✅ Complete    | `path_diversification.ts` — high-priority WARRANT_VOTE frames duplicated along disjoint paths.                                                                                                                                                                                                                                                                                                                                                                                                                |
| 1180 | ✅ Complete    | `convergence_detector.ts` — destination-side observer; redundancy_rate, proven_carriers, stragglers.                                                                                                                                                                                                                                                                                                                                                                                                          |
| 1190 | ✅ Complete    | `resilience_snapshot.rs` + JS mirror — 32-byte FNV-1a-CRC report. Anchor `0x98E5_768B`.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 1200 | ✅ Complete    | `FRAME_TYPE_SNAPSHOT_DIGEST=5` + `peer_snapshot_monitor.ts` — compact digest + partition alarm wiring.                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1210 | ✅ Complete    | `auto_investigation.ts` — partition alarms auto-raise WARRANT_PROPOSAL; 3-AYE quarantine.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 1220 | ✅ Complete    | `investigation_convergence.ts` — corroboration tracker; lone/double/triple+/high confidence bands.                                                                                                                                                                                                                                                                                                                                                                                                            |
| 1230 | ✅ Complete    | `reputation_feedback.ts` — soft reputation penalty from corroboration.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1240 | ✅ Complete    | `mesh_health.ts` — composite score `[0, 1]`; bands; Q16-encodable.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 1250 | ✅ Complete    | `FRAME_TYPE_COMPOSITE_HEALTH=6` + `composite_monitor.ts` — composite broadcast; meta-partition at ≥0.20.                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1260 | ✅ Complete    | `frame_recorder.ts` — append-only ring buffer + replay; forensic determinism invariant.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 1270 | ✅ Complete    | `trace_sync.ts` — observationHash merge; merged replay ≥ individual replays.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 1280 | ✅ Complete    | `forensic_quorum.ts` — alarm-vs-merged-replay adjudication; deterministic digest.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1290 | ✅ Complete    | `FRAME_TYPE_QUORUM_VERDICT=7` + `quorum_broadcast.ts` — agreement tracker; lone/double/triple+.                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1300 | ✅ Complete    | `verdict_archive.ts` — ND-JSON cold archive; archive_hash chain-of-custody.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 1310 | ✅ Complete    | `archive_sync.ts` — set-difference delta exchange; bidirectional `syncRound` converges archives without re-shipping; collision detection preserves digest-as-content-address invariant.                                                                                                                                                                                                                                                                                                                       |
| 1320 | ✅ Complete    | `archive_sync_wire.ts` + `FRAME_TYPE_DELTA_CHUNK=8` — chunked delta envelope over 32-byte SporeFrames; header + per-record chunks tied by `envelope_hash`; out-of-order tolerant, dedup-idempotent, gap-detecting reassembly.                                                                                                                                                                                                                                                                                 |
| 1330 | ✅ Complete    | `archive_sync_driver.ts` — pure scheduler (per-peer base/backoff/cap, isPeerCold) + retransmission driver (`PendingEnvelope` accumulator, `decideAction` → complete/retransmit/wait/giveup, per-sequence + envelope giveup horizons).                                                                                                                                                                                                                                                                         |
| 1340 | ✅ Complete    | `archive_sync_coordinator.ts` — orchestrates N peers + M envelopes; `selectNextSyncPeers` priority order; `ingestPeerFrames` with originator/contributor tracking; `progressEnvelope` returns action + `target_peers` fanout; `fleetConvergenceRate` Q16 telemetry.                                                                                                                                                                                                                                           |
| 1350 | ✅ Complete    | `convergence_health.ts` — soft-band signal (converged/lagging/diverged/stranded) with alarm flag; folded into Era 1240 composite via optional `convergence_signal` input + `weight_convergence` opt; capped bonus, full-weight downside.                                                                                                                                                                                                                                                                      |
| 1360 | ✅ Complete    | `network_digest_aggregator.ts` — TTL-bounded per-peer `ArchiveDigestList` store; `networkDigests()` returns deduplicated sorted union of fresh peers; `convergenceSignal()` plumbs union into Era 1350; cross-relay-stable `networkDigestSetHash`.                                                                                                                                                                                                                                                            |
| 1370 | ✅ Complete    | `convergence_auto_sync.ts` — `rankPeersByNovelty` set-difference scoring; `selectMostInformativePeer` + `selectAlarmOverrideOrder` bypass cooldown (cold peers still excluded); `convergenceAlarmEvent` with FNV-1a hash anchor for cross-relay corroboration.                                                                                                                                                                                                                                                |
| 1380 | ✅ Complete    | `forensic_event_sink.ts` — append-only chain-anchored event log; per-entry `chain_hash` folds predecessor; FIFO eviction preserves chain validity for surviving prefix; `verifyChain` detects tampering; `eventChainAnchor` is cross-relay-stable; `diffEventSinks` mirrors Era 1310 set-difference.                                                                                                                                                                                                          |
| 1390 | ✅ Complete    | `event_sink_sync.ts` — set-difference sync for event sinks; `EventHashList` / `EventDelta` mirror Era 1310 shapes; `applyEventDelta` re-appends imported entries (fresh local chain links) preserving `event_hash` content address; collision rejection (same hash, different kind); `eventSyncRound` bidirectional convergence.                                                                                                                                                                              |
| 1400 | ✅ Complete    | `omega_v2/src/forensic_event_sink.rs` — Rust mirror of Era 1380 sink + Era 1390 hash primitives, `no_std`-clean, fixed-capacity ring buffer, `MAX_KIND_LEN=16`, `MAX_ANCHOR_HASHES=64`. Cross-substrate locked anchors `0x929932B5` / `0x843F5862` pinned in both Rust and JS test suites — drift detection on either side.                                                                                                                                                                                   |
| 1410 | ✅ Complete    | `event_sink_wire.ts` + `FRAME_TYPE_EVENT_HASH_LIST=9` / `FRAME_TYPE_EVENT_DELTA_CHUNK=10` (Rust + JS); chunkable event-delta envelope with same out-of-order/idempotent/gap-detecting properties as Era 1320 archive wire; locked Rust frame-type registry test mirrors JS values.                                                                                                                                                                                                                            |
| 1420 | ✅ Complete    | `omega_v2/src/event_broadcast.rs` — Cortex-M4F frame builders (`event_hash_list`, `event_delta_chunk_header`, `event_delta_chunk_record`), `pack_kind_tag` cross-substrate parity, `BroadcastBuffer<N>` no-alloc FIFO, deterministic `broadcast_tick`. Spore is now first-class convergence participant.                                                                                                                                                                                                      |
| 1430 | ✅ Complete    | `omega_v2/src/event_sync_loop.rs` — `EventDeltaAccumulator<C>` reassembler (out-of-order, dedup, corruption-detect), `apply_event_delta` two-phase merger with collision rejection, `PeerSyncSlot` + scheduler ops. Smoke-test `two_spores_converge_via_round_trip` confirms substrate-only convergence.                                                                                                                                                                                                      |
| 1440 | ✅ Complete    | `omega_v2/src/cross_substrate_wire.rs` + `tests/cross_substrate_wire_test.ts` — `LOCKED_ENVELOPE_BYTES` 128-byte snapshot of a 4-frame envelope; both substrates emit, parse, reassemble, and apply against the same byte sequence with anchor `0x9299_32B5`. Full wire-byte interop, not just structural parity.                                                                                                                                                                                             |
| 1450 | ✅ Complete    | `omega_v2/src/spore_runner.rs` — `WireDriver` trait + `SporeRunner<N,C>` tick-driven loop with magic-byte resync, frame-type routing, automatic apply-on-complete, periodic hash-list broadcast, `ship_delta` helper. `LoopbackDriver` + paired-runner test proves end-to-end convergence over a real byte stream.                                                                                                                                                                                            |
| 1460 | ✅ Complete    | `omega_v2/src/convergence_driver.rs` — `ConvergenceDriver<M>` per-peer table tracking `last_seen_anchor` + scheduler slot; `select_targets` returns peers with anchor mismatch, schedule-allowed, ordered by oldest last-attempt; `ship_to_peer` records attempt/success/failure cleanly; reactive convergence loop closed on the substrate.                                                                                                                                                                  |
| 1470 | ✅ Complete    | `event_hash_list_wire.ts` + `FRAME_TYPE_EVENT_HASH_REQUEST=11` / `FRAME_TYPE_EVENT_HASH_RESPONSE=12` (Rust + JS); chunked hash-list response (4 hashes per frame, seq/total/valid packed in reserved); `computeMissingFromPeer` set-difference helper; bandwidth-efficient precise diff shipping.                                                                                                                                                                                                             |
| 1480 | ✅ Complete    | `HashListAccumulator<C>` + `compute_missing_indices` in `event_sync_loop.rs`; `SporeRunner` now routes HASH_REQUEST/HASH_RESPONSE, exposes `ship_hash_request` / `ship_hash_list` / `maybe_answer_pending_request` / `take_peer_hashes`. End-to-end `era_1480_request_response_diff_ship_pipeline` test proves: A→B request, B→A response, A→B precise diff (1 entry, not full set).                                                                                                                          |
| 1490 | ✅ Complete    | `AutoPipeline<M>` in `convergence_driver.rs` wraps the full HASH_REQUEST → HASH_RESPONSE → DIFF_SHIP state machine: `step` issues a request to a mismatched peer, awaits response on a deadline, computes diff via `compute_missing_indices`, ships only missing entries, and records scheduler success/failure. End-to-end test `auto_pipeline_completes_on_response_with_diff_ship` proves it.                                                                                                              |
| 1500 | ✅ Complete    | `webrtc_event_bridge.ts` — `WebRTCEventBridge` wraps Era 1380 sink + Era 1390 sync over a transport-agnostic `BridgeTransport`. JSON-message protocol (PEER_HELLO/HASH_LIST/DELTA), automatic DELTA-back on HASH_LIST receipt, schema-mismatch rejection, collision counters, peer-known gating. Bidirectional convergence in 2 rounds proven via paired in-process loopback.                                                                                                                                 |
| 1510 | ✅ Complete    | `mesh_event_bridge.ts` — `MeshBridgeTransport` adapter wraps Era 1500 `BridgeTransport` over a per-peer plasmid emit callback; `'EVENT_SYNC'` semanticType + `eventSyncBody`/`eventSyncTarget` fields added to `PlasmidPayload`; `decodeMeshPayload` receiver-side helper. Two-bridge convergence end-to-end through the adapter proven.                                                                                                                                                                      |
| 1520 | ✅ Complete    | `event_chain_quorum.ts` — `EventChainQuorumTracker` records peer anchor claims with TTL eviction; `snapshot` returns `{consensus_anchor, band: lone/double/triple+/high, dissenter_peer_ids, agreement_q16}` for cross-relay observability. Mirrors Era 1220 corroboration applied at the event-chain layer.                                                                                                                                                                                                  |
| 1530 | ✅ Complete    | `quorum_investigation.ts` — `QuorumInvestigationTrigger` decides which dissenters warrant forensic investigation: gated on `min_band`, `min_dissent_duration_ms`, `per_peer_cooldown_ms`. Returns `{fire_now, pending, dissenter_count}`; consensus changes reset duration tracking but preserve cooldowns. Pure decision logic — caller wires `fire_now` peers into the existing warrant pipeline.                                                                                                           |
| 1540 | ✅ Complete    | `quorum_warrant_bridge.ts` — `QuorumWarrantBridge` consumes Era 1530's `fire_now` and emits `WarrantProposalPayload[]` with `senateHash`-compatible proposalHash + deterministic description; per-peer dedup window prevents double-issue. Cross-module test confirms `senateHash` matches `WebRTCV2Mesh.senateHash` exactly so warrants flow through the existing 3-of-5 oracle gate unchanged.                                                                                                              |
| 1550 | ✅ Complete    | `auto_investigation_loop.ts` — `AutoInvestigationLoop` orchestrator stitches Eras 1380→1540 into a single `tick(now_ms)` that observes peer anchors, evaluates quorum, fires triggers, builds warrants, emits via caller callback, and records cooldowns. End-to-end 5-peer test: 1 dissenter against 4-peer consensus → 1 warrant proposal emitted with matching hash. **1000-test threshold crossed.**                                                                                                      |
| 1560 | ✅ Complete    | Quarantine-aware exclusion in `EventChainQuorumTracker` (`exclude`/`unexclude`/`excludedPeers`) and `AutoInvestigationLoop` (`excludePeer`/`includePeer`). Quarantined peers' anchor observations silently dropped at observe-time and their existing observations purged. Closes the feedback loop: warrant → quarantine → exclusion stops them gaming subsequent quorum rounds.                                                                                                                             |
| 1570 | ✅ Complete    | `quarantine_lifecycle_bridge.ts` — `QuarantineLifecycleBridge` subscribes to `quarantine-engaged` / `quarantine-resolved` events on a transport-agnostic `EventSource` (production uses `globalThis`, tests use `LocalEventSource`); auto-calls `loop.excludePeer` / `includePeer`; malformed-payload counter; configurable event names. End-to-end loop closure proven without operator intervention.                                                                                                        |
| 1580 | ✅ Complete    | `multi_sink_investigator.ts` — `MultiSinkInvestigator` holds Map<sink_id, AutoInvestigationLoop>; per-sink observation routing; `tickAll` / `tickOne`; shared `excludePeerGlobally` propagates to all existing + future sinks; emit callback receives `sink_id` metadata for downstream routing; deterministic sorted-id iteration. End-to-end multi-sink + global-quarantine scenario proven.                                                                                                                |
| 1590 | ✅ Complete    | `forensic_sink_schema.ts` — `ForensicSinkSchema` `{name, major, minor}` parsed from `"name:vMAJOR.MINOR"` strings; `compatibleSchemas` predicate (same name + same major; minor permissive); `SinkSchemaRegistry` with `sinksByName` / `compatibleSinks` / per-schema summary. Operators can mark each sink's content domain explicitly + identify which sinks can safely exchange deltas.                                                                                                                    |
| 1600 | ✅ Complete    | `event_sink_sync_schema.ts` — `SchemaTaggedDelta` / `SchemaTaggedHashList` wrappers; `applyEventDeltaWithSchema` validates compatibility before delegating to Era 1390 with typed rejection codes (`name-mismatch`, `major-mismatch`, `sender-schema-malformed`, `wrapper-schema-mismatch`, `apply-failed`); `SchemaAwareSinkSync` class auto-enforces the contract. Era 1390 path unchanged — schema layer is purely additive.                                                                               |
| 1610 | ✅ Complete    | `multi_sink_schema_aware.ts` — `SchemaAwareMultiSinkInvestigator` composes Era 1580 `MultiSinkInvestigator` + Era 1590 `SinkSchemaRegistry` + Era 1600 schema validation. `addSink(id, schema_string, opts)` validates schema before touching multi state (rolls back on failure). `observePeerAnchor` validates compatibility before forwarding; `peer_schema` arg optional for legacy compat. Per-rejection telemetry counters; `compatibleSinks`/`sinksByName` discovery. **1100-test threshold crossed.** |
| 1620 | ✅ Complete    | `schema_translator.ts` — `SchemaTranslator` function type + `SchemaTranslatorRegistry` keyed by `(source_name:source_major) → (target_name:target_major)`. Identity for compatible pairs; explicit translator opt-in for major bumps and cross-domain bridging; `translateBatch` returns `{translated, dropped}` or `null` when no translator registered. Closes the migration-window gap left by Era 1610's hard refusal of major mismatches.                                                                |
| 1630 | ✅ Complete    | `event_sink_sync_schema.ts` now accepts an optional `SchemaTranslatorRegistry`; major mismatches still refuse by default, but registered sender→local translators run over `missing_entries`, recompute `delta_hash`, and delegate to Era 1390 unchanged. `SchemaAwareSinkSync` can also answer translatable peer hash-lists. Translation diagnostics expose `translated_count` / `dropped_count`.                                                                                                            |
| 1640 | ✅ Complete    | `multi_sink_schema_aware.ts` now owns a shared optional `SchemaTranslatorRegistry`; `registerTranslator`, `translatableSinks`, and `compatibleOrTranslatableSinks` lift Era 1630 into operator discovery. Major-mismatch observations still refuse unless a sender→local translator is registered. Multi-sink telemetry now exposes registered pairs plus per-sink translated/dropped/applicable-observation counters.                                                                                        |
| 1650 | ✅ Complete    | `translation_policy_monitor.ts` canonicalizes `SchemaTranslatorRegistry.listPairs()`, computes deterministic FNV-1a policy digests, builds peer policy claims, observes peer claims with TTL/capacity bounds, deduplicates drift alarms, and optionally sinks `translation-policy-drift` forensic events. Translation authorization drift is now observable before translated sync runs.                                                                                                                      |
| 1660 | ✅ Complete    | `mesh_event_bridge.ts` now includes `TranslationPolicyMeshBridge`, `decodeTranslationPolicyMeshPayload`, and `translationPolicyPlasmidFields` for carrying Era 1650 policy claims over mesh plasmids. `webrtc_v2.ts` adds `TRANSLATION_POLICY` semantic payload fields and dispatches passive `translationPolicyClaim` events for application-owned monitors. End-to-end bridge tests prove remote monitors observe drift via wire payloads.                                                                  |
| 1670 | ✅ Complete    | `translation_policy_warrant_bridge.ts` converts `TranslationPolicyDriftEvent` into Senate-compatible `WarrantProposalPayload` values with deterministic `TPOL ...` descriptions, `senateHash` parity, per peer+local_policy+peer_policy dedup, reissue-after-window behavior, and explicit forget/snapshot diagnostics. Policy drift can now enter the existing oracle warrant gate without bypassing it.                                                                                                     |
| 1680 | ✅ Complete    | `translation_policy_investigation_loop.ts` stitches Eras 1650→1670: decode mesh policy claim bodies, observe them in `TranslationPolicyMonitor`, collect fresh drift alarms, build warrant proposals through `TranslationPolicyWarrantBridge`, emit via caller callback, and expose telemetry for malformed claims, drift events, built/emitted/failed/deduped proposals, and monitor peer counts.                                                                                                            |
| 1690 | ✅ Complete    | `translation_policy_corroboration.ts` adds timestamp-independent policy-drift equivalence hashes, lone/double/triple+/high witness bands, fixed-capacity corroboration records, idempotent per-witness counting, and high-confidence callbacks. `TranslationPolicyInvestigationLoop` now accepts an optional corroboration gate (`witness_id`, `min_confidence`) that blocks proposal emission until the required band is reached while preserving the default single-observer mode.                          |
| 1700 | ✅ Complete    | `translation_policy_corroboration.ts` now defines a compact `TranslationPolicyCorroborationRaise` wire shape (`OMEGA-1700/v1`) with deterministic `drift_hash` validation and `recordRaise(...)` ingestion. `mesh_event_bridge.ts` adds decode/plasmid helpers plus `TranslationPolicyCorroborationMeshBridge`; `webrtc_v2.ts` adds passive `TRANSLATION_POLICY_CORROBORATION` payload dispatch. Remote witness raises can now converge a local corroboration tracker over mesh transport.                    |
| 1710 | ✅ Complete    | `translation_policy_live_wiring_adapter.ts` closes the live application wiring gap: subscribes to WebRTC-dispatched `translationPolicyClaim` / `translationPolicyCorroborationRaise` events, routes claim bodies into `TranslationPolicyInvestigationLoop`, records remote raises into the configured corroboration tracker, exposes malformed/observed/emitted telemetry, and can optionally emit local corroboration raises after local drift observations.                                                 |
| 1720 | ✅ Complete    | `translation_policy_broadcast_scheduler.ts` adds a deterministic outbound scheduler over `TranslationPolicyMeshBridge`: known-peer table, per-peer cooldown/backoff via Era 1330 primitives, cold-peer exclusion, max-per-tick attempt cap, unchanged policy-hash suppression with refresh horizon, and explicit sent/failed/skipped decisions. Local policy claims can now be broadcast without caller-managed loops or duplicate unchanged spam.                                                            |
| 1730 | ✅ Complete    | `translation_policy_peer_directory.ts` wires the Era 1720 scheduler to mesh lifecycle/activity events through a transport-agnostic `EventSource`: joins add peers, leaves remove peers, translation-policy claim/corroboration activity refreshes senders, string WebRTC peer ids are deterministically FNV-1a normalized to numeric peer ids, and `webrtc_v2.ts` now emits passive `meshPeerJoined` / `meshPeerLeft` events.                                                                                 |
| 1740 | ✅ Complete    | `translation_policy_runtime.ts` provides the operator-owned facade over Eras 1710/1720/1730: starts/stops live wiring and peer directory together, exposes one `tick(now_ms, max_peers)` for broadcast scheduling, and returns combined telemetry with active flags, peer/due-peer counts, live wiring counters, directory counters, and investigation-loop summary.                                                                                                                                          |
| 1750 | ✅ Complete    | `translation_policy_hud.ts` converts Era 1740 runtime telemetry into compact HUD-ready fields without mutating DOM: nominal/watch/drift/blocked bands, stable glyphs, summary truncation, policy hash/drift field, peer/due-peer field, and warrant/corroboration field. `TranslationPolicyInvestigationLoop.summary` now exposes local policy hash + pair count for operator display.                                                                                                                        |
| 1760 | ✅ Complete    | `translation_policy_hud_hook.ts` + optional `bootstrap/v2.ts` hook — accepts an operator-owned runtime via `window.__OMEGA_TRANSLATION_POLICY_RUNTIME__` and writes compact Era 1750 telemetry to one existing HUD slot only when `window.__OMEGA_TRANSLATION_POLICY_HUD__` explicitly enables it. Throttled, exception-contained, no DOM contract expansion, no automatic takeover of kernel telemetry.                                                                                                      |
| 1770 | ✅ Complete    | `translation_policy_runtime_factory.ts` assembles the Era 1740 runtime graph from local peer/witness ids, translator registry, event source, claim emit, corroboration emit, and warrant emit callbacks. Includes optional `auto_start`, default double-witness corroboration gate, option plumbing, and `installTranslationPolicyRuntimeGlobal(...)` for the Era 1760 bootstrap hook.                                                                                                                        |
| 1780 | ✅ Complete    | `translation_policy_mesh_emit_adapter.ts` turns any `enqueuePlasmid` mesh surface into Era 1770-compatible `claim_emit`, `raise_emit`, and `warrant_emit` callbacks. Builds existing `TRANSLATION_POLICY`, `TRANSLATION_POLICY_CORROBORATION`, and Senate-compatible `PROPOSAL` plasmids from one validated dipole template and tracks sent/failed telemetry.                                                                                                                                                 |
| 1790 | ✅ Complete    | `translation_policy_bootstrap_installer.ts` composes the Era 1780 mesh emit adapter + Era 1770 runtime factory + Era 1760 runtime/HUD globals behind one opt-in installer call. `bootstrap/v2.ts` now invokes it only when `window.__OMEGA_TRANSLATION_POLICY_BOOTSTRAP__` is enabled; invalid config is contained and default behavior remains inert.                                                                                                                                                        |
| 1800 | ✅ Complete    | `translation_policy_runtime_tick_hook.ts` drives installed runtime `tick(now_ms,max_peers)` at a bounded cadence independent of HUD formatting. Installer now publishes `__OMEGA_TRANSLATION_POLICY_TICK__` (enabled by default for opt-in installs, disable with `tick:false`), and `bootstrap/v2.ts` invokes the hook each frame with throttling/error containment.                                                                                                                                         |
| 1810 | ✅ Complete    | `translation_policy_bootstrap_telemetry.ts` provides one stable diagnostic snapshot over install status, tick status, last broadcast counters, runtime telemetry, and mesh-emitter sent/failed counters. `bootstrap/v2.ts` publishes `window.__OMEGA_TRANSLATION_POLICY_TELEMETRY__` every frame without adding DOM slots or driving network IO.                                                                                                                                                              |
| 1820 | ✅ Complete    | `translation_policy_telemetry_event.ts` turns the Era 1810 snapshot into an opt-in throttled `translationPolicyTelemetry` CustomEvent stream with deterministic FNV-1a change detection, wall-clock churn suppression, configurable event names, dispatch-error containment, installer option plumbing, and `bootstrap/v2.ts` emission after snapshot publication.                                                                                                                                            |
| 1830 | ✅ Complete    | `translation_policy_forensic_event_adapter.ts` listens to `translationPolicyTelemetry` through the existing `EventSource` contract and appends compact `kind="tpol"` records to `ForensicEventSink` only when the forensic projection changes. Payloads carry policy hash, pair/peer/drift/malformed/proposal counts, install/tick errors, HUD-compatible bands plus dedicated disabled/install-error/tick-error bands, and source telemetry hash while keeping bootstrap decoupled from sinks.               |
| 1840 | ✅ Complete    | `translation_policy_forensic_replay.ts` classifies synced/replayed `tpol` forensic events into deterministic band timelines, local policy-hash intervals, install/tick/proposal/malformed error windows, first/last replay time, final band/hash, and ignored/malformed counts. Replay is pure, sorted by `sunk_at_ms`/`sequence`/`event_hash`, and never mutates the sink.                                                                                                                                   |
| 1850 | ✅ Complete    | `translation_policy_forensic_replay_hud.ts` formats Era 1840 replay classifications into compact HUD/report fields: final band, final policy hash, policy interval count, first active error, drift duration, malformed aggregate, terminal-safe glyph, and deterministic truncation. It remains a pure formatter with no DOM writes or sink mutation.                                                                                                                                                        |
| 1860 | ✅ Complete    | `translation_policy_forensic_replay_digest.ts` content-addresses Era 1840 replay interpretations with FNV-1a over canonical band timelines, policy intervals, error windows, classified/malformed counts, final band, and final policy hash. Component hashes and `sameTranslationPolicyForensicReplayDigest(...)` let relays prove their replay interpretations match while ignoring non-interpretive bookkeeping.                                                                                           |
| 1870 | ✅ Complete    | `translation_policy_replay_digest_claim.ts` defines compact `OMEGA-1870/v1` replay-digest claims over Era 1860 digests, with strict decode, local-digest match checks, peer/witness/time-insensitive equality, plasmid field helpers, and a minimal bridge. `webrtc_v2.ts` adds passive `TRANSLATION_POLICY_REPLAY_DIGEST` dispatch as `translationPolicyReplayDigestClaim` without owning application state.                                                                                                 |
| 1880 | ✅ Complete    | `translation_policy_replay_digest_quorum.ts` tracks per-peer replay-digest claims with TTL eviction, deterministic consensus digest selection, lower-digest tie-breaks, dissenting peer ids, distinct digest sets, Q16 agreement telemetry, `lone`/`double`/`triple+`/`high` bands, and peer-sorted lookup by digest. Replay interpretation drift is now observable after forensic sink sync.                                                                                                                 |
| 1890 | ✅ Complete    | `translation_policy_replay_digest_live_wiring.ts` subscribes to passive `translationPolicyReplayDigestClaim` events, decodes Era 1870 bodies, feeds the Era 1880 quorum tracker, exposes received/malformed/observed telemetry, supports custom event names, and provides explicit local digest-claim emission with provider/peer/witness options plus built/emitted/failed/skipped counters.                                                                                                                 |
| 1900 | ✅ Complete    | `translation_policy_replay_digest_hud.ts` formats live replay-digest quorum snapshots plus Era 1890 telemetry into compact fields for quorum state, consensus digest/agreement, dissenters, and IO health. Banding is pure (`blocked` on local emission failure, `drift` on dissenters, `watch` on no/lone/malformed claims, otherwise `nominal`) with stable ASCII glyphs and deterministic truncation.                                                                                                      |
| 1910 | ✅ Complete    | `translation_policy_replay_digest_forensic_event_adapter.ts` appends compact `tpdq` forensic events from replay-digest quorum snapshots + live telemetry. It uses a stable FNV-1a projection that excludes wall-clock emission time, skips unchanged projections, records nominal/drift/blocked/watch bands, and exposes append/skip/failure/last-hash telemetry without owning timers, DOM, or mesh IO.                                                                                                      |
| 1920 | ✅ Complete    | `translation_policy_replay_digest_forensic_replay.ts` classifies synced `tpdq` forensic events into deterministic quorum-band timelines, consensus-digest intervals with count/total/agreement Q16, drift/malformed/local-claim-failure windows, first/last replay time, final band, and final consensus digest. Replay is pure, ordered by `sunk_at_ms`/`sequence`/`event_hash`, and never mutates the sink.                                                                                                 |
| 1930 | ✅ Complete    | `translation_policy_replay_digest_forensic_replay_hud.ts` formats Era 1920 offline/synced-sink replay classifications into compact report fields: final quorum band + glyph, final consensus digest + interval count, first active error, drift duration, malformed totals, local-claim-failure totals, and deterministic truncation. Pure formatter; no DOM, sink mutation, mesh IO, or runtime subscription.                                                                                                |
| 1940 | ✅ Complete    | `translation_policy_replay_digest_forensic_replay_digest.ts` content-addresses Era 1920 `tpdq` replay interpretations with FNV-1a over canonical band timelines, consensus digest intervals, error windows, classified/malformed counts, final band, and final consensus digest. Component hashes plus `sameTranslationPolicyReplayDigestForensicReplayDigest(...)` let relays compare offline replay interpretations without shipping full timelines.                                                        |
| 1950 | ✅ Complete    | `translation_policy_replay_digest_digest_claim.ts` defines compact `OMEGA-1950/v1` claims over Era 1940 `tpdq` replay-interpretation digests, with strict decode, local-digest match checks, peer/witness/time-insensitive equality, plasmid field helpers, and a minimal bridge. `webrtc_v2.ts` adds passive `TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST` dispatch as `translationPolicyReplayDigestDigestClaim` without owning application state.                                                              |
| 1960 | ✅ Complete    | `translation_policy_replay_digest_digest_quorum.ts` tracks Era 1950 `tpdq` replay-interpretation digest claims with TTL eviction, deterministic consensus digest selection, lower-digest tie-breaks, dissenting peer ids, distinct digest sets, Q16 agreement telemetry, `lone`/`double`/`triple+`/`high` bands, and peer-sorted lookup by digest.                                                                                                                                                            |
| 1970 | ✅ Complete    | `translation_policy_replay_digest_digest_live_wiring.ts` subscribes to passive `translationPolicyReplayDigestDigestClaim` events, decodes Era 1950 bodies, feeds the Era 1960 quorum tracker, exposes received/malformed/observed telemetry, supports custom event names, and provides explicit local digest-claim emission with provider/peer/witness options plus built/emitted/failed/skipped counters.                                                                                                    |
| 1980 | ✅ Complete    | `translation_policy_replay_digest_digest_hud.ts` formats live `tpdq` replay-interpretation digest quorum snapshots plus Era 1970 telemetry into compact fields for quorum state, consensus digest/agreement, dissenters, and IO health. Banding is pure (`blocked` on local emission failure, `drift` on dissenters, `watch` on no/lone/malformed claims, otherwise `nominal`) with stable ASCII glyphs and deterministic truncation.                                                                         |
| 1990 | ✅ Complete    | `translation_policy_replay_digest_digest_forensic_event_adapter.ts` appends compact `tpdd` forensic events from digest-digest quorum snapshots + live telemetry. It uses a stable FNV-1a projection that excludes wall-clock emission time, skips unchanged projections, records nominal/drift/blocked/watch bands, and exposes append/skip/failure/last-hash telemetry without owning timers, DOM, or mesh IO.                                                                                               |
| 2000 | ✅ Complete    | `translation_policy_replay_digest_digest_forensic_replay.ts` classifies synced `tpdd` forensic events into deterministic digest-digest quorum history: band timeline, consensus digest intervals, drift/malformed/local-failure windows, first/last classified event time, final band, and final consensus digest. Pure replay only; no sink mutation, timers, DOM, or mesh IO.                                                                                                                               |
| 2010 | ✅ Complete    | `translation_policy_replay_digest_digest_forensic_replay_digest.ts` computes a deterministic content address for Era 2000 `tpdd` replay interpretations. It hashes canonical band timelines, consensus digest intervals, and error windows; includes classified/malformed/final state; and ignores non-interpretive bookkeeping so relays can compare conclusions without shipping full timelines.                                                                                                            |
| 2020 | ✅ Complete    | `translation_policy_replay_digest_digest_forensic_replay_hud.ts` formats offline `tpdd` replay interpretations plus Era 2010 replay digest into compact operator fields: final band, final consensus digest, interval count, replay digest hex, active error, drift duration, malformed count, and local failure count. Pure HUD formatter only; no DOM writes or live state.                                                                                                                                 |
| 2030 | ✅ Complete    | `translation_policy_replay_digest_digest_forensic_replay_digest_claim.ts` makes Era 2010 `tpdd` forensic replay digests wire-claimable. It adds a strict `OMEGA-2030/v1` claim schema, builder/decoder, exact digest matcher, content equality helper that ignores peer/witness/time, plasmid-field helper, and bridge wrapper for caller-owned mesh/event emission.                                                                                                                                          |
| 2035 | ✅ Complete    | `translation_policy_protocol_registry.ts` maps the Era 1650→2030 translation-policy spine into a tested registry with layer status, mesh semantic/event/payload metadata, forensic namespaces, audit counts, and explicit integration-gap detection. It originally identified Era 2030 as `claimable-offline`, giving Era 2040 a precise integration target.                                                                                                                                                  |
| 2040 | ✅ Complete    | `webrtc_v2.ts` and `mesh_event_bridge.ts` now expose Era 2030 claims through a passive mesh dispatch surface: semantic type `TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_DIGEST`, event `translationPolicyReplayDigestDigestForensicReplayDigestClaim`, body/target payload fields, strict mesh decoder, plasmid-field helper, and bridge wrapper. The Era 2035 registry now reports this surface as `passive-dispatch` with no open gap.                                                         |
| 2050 | ✅ Complete    | `translation_policy_protocol_registry.ts` now includes `OMEGA-2050/v1` spine compression policy: every layer is classified as live-operational, passive-transport, forensic-source, offline-audit, or recursive-derived; extension policy marks live integration, audit-only, registry-review, or cap-recursion. The replay-derived tail from Era 1910 through 2030 is explicitly capped before another quorum/HUD/forensic recursion cycle can be added.                                                     |
| 2060 | ✅ Complete    | `translation_policy_spine_diagnostics.ts` formats Era 2050 compression into a pure operator/agent diagnostic snapshot: schema `OMEGA-2060/v1`, bands `nominal`/`review`/`capped`/`blocked`, compact ordered fields, capped range `1910-2030 (13)`, cap-list output for agent audit, and deterministic truncation. No DOM, mesh IO, timers, sink mutation, or live state.                                                                                                                                      |

### Open Trigger

- **Era 2070: Translation Policy Compression Telemetry Exposure** — Publish the
  Era 2060 diagnostic snapshot through an existing telemetry/global surface so
  future agents and operators can see the cap without importing the formatter
  manually. Keep it read-only and opt-in; do not add quorum/runtime recursion.
- **Era 1040 Phase 3 ✅ Complete** — `omega_zk_host` builds real SP1 STARKs and
  verifies them locally; ELF (`riscv64im-succinct-zkvm-elf`) is reproducible via
  `cargo prove build`. Self-test produces
  `{verified: true, kind: "stark-mock", receipt_hash: "0xd434e690"}`.

---

## 6. Coding Conventions

### Rust (`omega_v2`)

- `#![no_std]` — no `alloc`, no `std`. Static arrays only.
- `unsafe` blocks are **minimized** and always documented with a safety comment.
- FFI exports: `#[no_mangle] pub extern "C" fn v2_*`. Never use `wasm-bindgen`
  in v2.
- Tests go in `mod tests { ... }` inside the same file. Run with
  `cargo test -p omega_v2`.

### TypeScript / WebGPU

- Use `CallableFunction` cast for WASM exports:
  `(this.engine.wasm.exports.v2_foo as CallableFunction)()`.
- Ping-pong buffers: `agentsPingPong` toggles 0/1 per frame. Source = A/B
  alternating.
- Bind groups are **recreated per frame** in `tick()` because source/target
  buffers swap.
- `layout: 'auto'` on compute pipelines — WGSL source of truth for bindings.

### WGSL

- All math is **integer-only** (`i32`, `u32`). No `f32` in physics kernels.
- Workgroup size is **64** (`@workgroup_size(64)`) to match GPU wavefronts.
- Use `atomicAdd` only in mean-field reduction (Era 4000). No atomics on agent
  data.

---

## 7. Testing Rules

1. **Any change to `omega_v2/src/` MUST pass `cargo test -p omega_v2`.**
2. **Any change to `src/network/` MUST pass `deno test tests/routing_*.ts`.**
3. **Any change to WGSL shaders MUST be manually verified for compilation**
   (WebGPU validates at runtime; there is no offline WGSL compiler in the repo).
4. Golden Trace divergence = **hard stop**. If `v2_get_golden_trace` differs
   between runs, you broke determinism.

---

## 8. Common Pitfalls

- **`agents` vs `agents_in` in WGSL:** `compute_v2.wgsl` MUST read from
  `agents_in` (binding 2). Writing to `agents_out` (binding 7).
- **Buffer size mismatch:** `AttractorArray` is **80 bytes** (includes `count` +
  padding), not 64. Both Rust and WGSL must agree.
- **Unsafe nested blocks:** In `lattice.rs`, `darwinian_mitosis` already wraps
  its body in `unsafe { ... }`. Do not add a second nested `unsafe`.
- **HUD slot limit:** `setHudStat` only accepts `"a"|"b"|"c"|"d"|"e"`. Add new
  DOM elements in `index.html` and `dom.ts` before using a new slot.

---

## 9. How to Extend

### Adding a new WASM export

1. Add function to `omega_v2/src/lib.rs` with `#[no_mangle] pub extern "C"`.
2. Add to `WasmExports` interface in `src/network/routing_bridge.ts` (or
   relevant bridge).
3. If it returns a pointer, expose it through `getMemoryPointers()` in
   `v2_bridge.ts`.
4. Write a Rust unit test in the same module.

### Adding a new GPU uniform/binding

1. Add struct to WGSL shader and declare `@group(0) @binding(N)`.
2. Create `GPUBuffer` in `v2_renderer.ts::initialize()` with correct size.
3. Add buffer to **both** compute bind groups (v2 + toroidal) in `tick()`.
4. If data comes from WASM, add pointer/bytes to `getMemoryPointers()` in
   `v2_bridge.ts`.
5. Write `device.queue.writeBuffer(...)` in `tick()` before compute dispatch.

### Adding a new Plasmid semanticType

1. Extend `PlasmidPayload.semanticType` union in `src/network/webrtc_v2.ts`.
2. Add case to the `switch (plasmid.semanticType)` in `V2_SYNC` handler.
3. Update `enqueuePlasmid` bounds / validation if needed.

---

## 10. Contact & Philosophy

> "The lattice is the source of truth. JS is the lens. GPU is the physics
> engine. ZK is the notary."

- Never mutate the lattice from JS except through official FFI exports.
- Never use `Math.random()` in physics-adjacent code. Use `xorshift64` with
  deterministic seeds.
- Every Era must be **reversible** — if it breaks, you can flip a boolean
  (`useToroidalShader`) or revert a task file.

**Current task status:** Tasks 0086 → 0193 are COMPLETED. Active Era 2060
exposes the Era 2050 recursion cap as a pure diagnostic formatter. Next work
should publish that diagnostic through an existing read-only telemetry/global
surface, not add another quorum layer.
