# Known Gaps (omega)

Credibility-first: this lists what is **not** finished or is knowingly rough, so
no reader over-trusts a capability. Federation-wide gaps live in trinity's
`docs/KNOWN_GAPS.md`; this file is omega-specific.

## Genesis identity

- The v1.0 Genesis Hash is **`0x716EA2F8`** (`OMEGA1:716ea2f8`). The earlier
  `0x549A6307` was the on-paper freeze and was **never inscribed on-chain**.
- The two **mitosis** anchors (`0xF73DB063`, `0x8C3AC082`) are pinned to their
  **frozen inputs** — the anchor child as the kernel derived it at freeze
  (e8b685e). The _live_ kernel now derives a different child
  (energy/state/genome evolved with the physics), so the live receipt
  (`0x1B18EEA0`) differs by design. `tests/genesis_anchor_provenance.rs` / `.ts`
  recompute every anchor from frozen inputs and pin `0x716EA2F8` — the guardrail
  that was missing when the anchors first drifted.
- The genesis `first_proposal_hash` anchor hashes the canonical string
  `"Task 0090: Era 1040 - ZK-Notarized Mutations"`; the _live_ bootstrap first
  proposal (`src/bootstrap/v2.ts`) submits a longer human-readable description,
  so the live proposal key (`0x55074120`) is not the frozen anchor
  (`0x30083117`). This is a content difference, not a hash bug.

## Hashing

- Senate/mitosis hashing is **SHA-256** (folded to u32) on both Rust and TS. The
  _outer_ genesis inscription is still FNV-1a-32 over the anchor bytes (by
  design). Remaining FNV-1a in TS is non-consensus (`phi_bridge.emitIntent`,
  `compost_synapse.fastHash`, the `fnv1a` helper).

## Bare-metal spore (`omega_spore`)

- Builds for its bare-metal target
  (`cargo build --release
  --manifest-path omega_spore/Cargo.toml --target thumbv7em-none-eabihf`
  → a ~17 KB firmware binary). The `spore` feature omits the sanctuary/mitosis
  sweep (`lattice::darwinian_mitosis` + the `v2_mitosis_sweep` FFI export),
  which pulls in `codeicide_law`; the spore does not carry that path.

## Dev tools

- `tools/simulate_mesh.ts` — the deterministic autopoietic-flow simulator is
  HEALTHY (the earlier bit-rot note was stale): re-run 2026-08-01, all seven
  phases (Era 1010→1070) reproduced deterministically, 0 invariant violations, 0
  drift, frozen anchors verified (`0xf73db063`, `0x716ea2f8`).
- `tools/generate_phase_goldens.ts` / `verify_phase_goldens.ts` — REMOVED
  2026-08-01: unrunnable orphans (imported a deleted `phase_golden_common.ts`,
  referenced by no task). Restorable from git history if the golden workflow is
  ever resurrected.

## ZK

- Completed **CPU** STARK proofs are checked in (`omega_zk_host/proofs/`,
  reverifiable — and, since 2026-08-02, re-verified by CI on every push rather
  than asserted here). GPU/network proving is hardware-bound.
- **This entry was false for most of July** and is kept as the reason the CI job
  exists. T3 changed the guest circuit (`alpha` became a Mode 3 wire field),
  which changed the verifying key, and from that moment all three checked-in
  bundles failed with `pc_start != vk.pc_start` while this line still said
  "reverifiable". Nothing ran them, so nothing contradicted the claim. The
  bundles were regenerated on 2026-08-02 against the current guest; the receipt
  hashes are unchanged, because what drifted was the program, not the physics.
- A bundle now carries a `program` block (verifying-key hash + guest ELF
  sha256 + length) and a `physics` block (`alpha`, `q_phase`). `--verify-only`
  checks the program commitment first, so "this proof is about a different
  circuit" is reported as that, and bundles predating the block are reported as
  unable to say.
- The guest build was measured byte-reproducible (three consecutive
  `cargo prove
  build` runs, identical ELF), which is what makes the CI job
  meaningful: the runner rebuilds the guest and must arrive at the same
  verifying key.
- `tests/mitosis_proof_zk_test.ts` and `tests/zk_physics_rollup_test.ts` expect
  a `"stark-mock"` bundle kind while the host defaults to `cpu`; they need
  re-anchoring to the current default (in the `test:integration`/zk tier). Note
  (2026-08-01): the rollup bundle kind is now `stark-<mode>-rollup` (was the
  hardcoded `"ZK_ROLLUP"`), and `run_rollup` actually verifies locally before
  reporting `verified: true`.
- `sp1-sdk` (host) and `sp1-zkvm` (guest) are pinned to `=6.3.1`. Reproducing
  the guest build/proofs needs the SP1 toolchain (`cargo prove`).

## Senate data plane (discovered 2026-08-01, WIRED same day — live proof pending)

The keyed-custody cryptography (`src/network/oracle_custody.ts`, Ed25519) is
real and tested, and as of 2026-08-01 the wire exists too:

- PROPOSAL / VOTE / DIPOLE plasmids travel as JSON on the dedicated `v2-senate`
  gossipsub topic (a VOTE carries a 64-byte Ed25519 signature; a DIPOLE two
  agents + attractor field — neither fits a 32-byte SporeFrame). `handleVote` /
  `handleProposal` are reachable via `handleSenateMessage`.
- The uppercase `ORACLE_MATRICES_V1["CLAUDE"]` bug (→ `caller_matrix = 0` → Rust
  rejected every senate patch) is fixed at all four call sites.
- `verifiedDipoleCount` is now incremented: DIPOLE verification + dedup live in
  the pure, unit-tested `src/network/dipole_accounting.ts`
  (`tests/dipole_accounting_test.ts`), wired both for wire-received and
  locally-originated births. The Era 1050→1060→1070 chain is _reachable_.
- `handleProposal` now initialises `ayesWeight`/`naysWeight` (their absence
  turned the tally into NaN and made peer-consensus unreachable).

Still OPEN:

- No live multi-node proof of a full 3-of-5 oracle vote over the wire — the path
  is wired and unit-tested at the pure-logic level, but `libp2p_mesh.ts` itself
  remains unimportable in unit tests (native WebRTC deps) and is not
  instantiated by a running daemon.
- The "5-oracle cross-model debate" in the browser is one local Qwen2-VL-2B
  playing all five seats unsigned (`src/workers/oracle_worker.ts`).
- The legacy binary PROPOSAL SporeFrame path (spore compat) still constructs a
  field-less mock that `handleProposal` ignores — senate proposals only flow via
  `v2-senate`.

## Renderer (CONFIRMED 2026-08-01, fixed statically — browser run still pending)

The suspicion was correct, and worse than reported:

- `renderer_buffers.ts` allocated `signalsBuffer` at 32 bytes while WGSL
  `SignalStore` is 48 — a hard `createBindGroup` validation failure under
  `layout: 'auto'`. `writeUniforms` also truncated the upload at 32 bytes
  (zeroing `total_energy`/p90 in the shader → `metabolic_pressure` would have
  clamped constant → GPU/CPU physics divergence).
- `renderer_modes.ts` bound a non-existent `binding 4` (intentBuffer) into both
  compute bind groups, and the render bind groups bound the agents STORAGE
  buffer at `binding 1` where `render_v2.wgsl` declares the signals uniform
  (agents belong at `binding 2`, signals was missing entirely).
- Deeper still: every TS reader of `active_agent_count` used a stale
  pre-`ProperTime` offset. The field lives at lattice-head byte **48** (signals
  at 32 + field at 16); `v2_renderer.ts` / `v2.ts` read byte 40
  (`phase_lock_integral`), `v2_bridge.ts` read u32 index 2
  (`topology.q_radial`), and `museum.ts` read bytes 4/24 of the topology block.
  HUD, dispatch size and snapshot restore were all fed garbage.

Fixed: buffer 48B, bindings mirror the shaders exactly, all readers re-anchored
to byte 48, dead `intentBuffer` removed. **Guardrail added:**
`tests/wgsl_layout_test.ts` parses WGSL structs/bindings and the TS bind
groups/buffer sizes and fails on drift (the WGSL twin of `ffi_layout.rs`). Still
OPEN: an actual browser run (`app.html` in Chrome, capture
`device.onuncapturederror`) — static analysis cannot prove the pipeline
executes, only that it validates.

## Mesh state sync (T6 — guarded 2026-08-01, protocol still unimplemented)

First, a correction to this file's earlier wording: the snapshot path was never
actually reachable — nothing in the codebase answers `REQ_SNAPSHOT` and nothing
ever allocates `incomingSnapshot`, so no peer could "answer first". The real
live defects were worse in a different way:

- **Permanent freeze (liveness)**: on `remoteGt > localTrace` the node set
  `isSyncFrozen = true` and published a request nobody answers; the only
  unfreeze lived in the dead reassembly branch. One divergent packet halted the
  local physics forever. Fixed: `DivergenceRecovery`
  (`src/network/sync_recovery.ts`, pure + unit-tested) freezes once per distinct
  remote gt, auto-releases after `SNAPSHOT_FREEZE_TIMEOUT_MS` (10 s), and
  refuses to re-freeze a gt that timed out unanswered (anti-flap).
  `isSyncFrozen` is now a getter over the machine.
- **Unbounded delta writes**: the Era 6000 "Xenobiological Mutations" path wrote
  raw `{index, phase, energy, genome}` tuples straight into WASM agent memory
  with no validation — a peer could mint `0xFFFFFFFF` ATP (Era 2080 forbids:
  energy is zero-sum except solar). Fixed at the boundary:
  `sanitizeDeltaMutation` bounds the index and clamps energy to `MAX_ATP`
  (4096), plus a per-message cap (`MAX_MUTATIONS_PER_MESSAGE`).

Still OPEN (by design / future Era):

- Delta mutagens remain **unauthenticated** — xenobiology is a deliberate
  open-infection feature; the guard only enforces physics, not identity.
- There is still **no snapshot protocol**: no `SNAPSHOT_BEGIN`, no chunking
  sender, no N-of-M agreement before `overwriteCallback`. The dead reassembly
  branch stays as a marker; implementing the protocol (with peer-agreement on
  `(gt, stateHash)` before injection) is a future Era.
- `handleStateMessage` chunk reassembly, if ever wired, must verify the
  assembled bytes against an agreed hash BEFORE touching GPU state.

## Fixed 2026-08-01 (Kimi Code CLI, maintainer pass — receipts in git)

- **Codeicide age classification** read `agent.memory[1]` as birth tick while
  `tick_physics` overwrites it every tick with packed Hebbian weights →
  systematic ANCIENT misclassification. `protected_status_for` /
  `is_action_lawful` now take `birth_tick` from `BIRTH_TICKS`; regression test
  `hebbian_memory1_is_never_read_as_birth_tick`.
- `v2_codeicide_status` used average energy while `v2_codeicide_is_lawful` used
  p90 — two windows into one law disagreed. Both use p90 now.
- **ZK rollup stdin desync**: host wrote the mode selector as u32, guest reads
  u8 → production `--rollup` path was broken (`--rollup-test` wrote u8
  correctly, masking it). Fixed; wire regression test
  `omega_zk_host/tests/wire_rollup.rs` (mock prover, 3 s).
- **ZK Mode 3 hardcoded `alpha: 0`** while production coupling is 64 → the
  rollup proved a non-canonical law. `alpha` is now on the wire (serde
  default 64) and committed in the public values.
- **MitosisLog layout drift**: Rust struct inherits align(32) from
  `PhaseAgentMinimal`, so `entries` begins at byte 32 — while JS used header 16
  and `v2_bridge.ts` even used receipt size 160 (pre-SHA-256). Fixed in
  `v2_bridge.ts` / `mitosis_log_reader.ts` (+ exported
  `MITOSIS_LOG_HEADER = 32`); pinned by `omega_v2/tests/ffi_layout.rs`
  (size_of/offset_of asserts for all FFI structs).
- Stale FNV-1a doc comments (post SHA-256 migration) corrected in `senate.rs`,
  `codeicide_law.rs`, `cross_model_debate.rs`, `warrant_issuance.rs`, `lib.rs`;
  stale oracle seat names in test comments (gpt/qwen/llama →
  codex/antigravity/kimi).
- **Renderer seam (third pass, same day)**: see the Renderer section above —
  signalsBuffer 48B, shader-exact bindings, `active_agent_count` re-anchored to
  lattice-head byte 48 everywhere (`v2_renderer.ts`, `v2_bridge.ts`, `v2.ts`,
  `museum.ts`), `tests/wgsl_layout_test.ts` contract added.
- **Compost (third pass)**: deleted 8 zero-importer files — `src/sdk/index.ts`,
  `src/shared/{memory_proxy,topology_core,topos_dictionary,dimensions}.ts`,
  `src/lens/math_3d.ts`, `src/ontology/{nomos_gate,phylogeny}.ts`. Deliberately
  KEPT despite appearing on the compost list: `src/bootstrap/museum.ts` +
  `src/ui/senate_viewer.ts` (live Vite entries via `museum.html` /
  `senate.html`; `tools/verify_dist.ts` requires the `dist/museum.html`
  artifact) and `src/sdk/phi_client.ts` (deliberate stub locked by
  `tests/honesty_triad_test.ts`).

## Mesh

- Relay store-and-forward is proven cross-machine; relay-store replication and
  DCUtR hole-punching (to upgrade "limited" relayed connections) are pending.
