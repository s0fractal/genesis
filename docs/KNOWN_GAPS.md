# Known Gaps (omega)

Credibility-first: this lists what is **not** finished or is knowingly rough, so
no reader over-trusts a capability. Federation-wide gaps live in trinity's
`docs/KNOWN_GAPS.md`; this file is omega-specific.

## Genesis identity

- The v1.0 Genesis Hash is **`0x716EA2F8`** (`OMEGA1:716ea2f8`). The earlier
  `0x549A6307` was the on-paper freeze and was **never inscribed on-chain**.
- The two **mitosis** anchors (`0xF73DB063`, `0x8C3AC082`) are pinned to their
  **frozen inputs** — the anchor child as the kernel derived it at freeze
  (e8b685e). The *live* kernel now derives a different child (energy/state/genome
  evolved with the physics), so the live receipt (`0x1B18EEA0`) differs by
  design. `tests/genesis_anchor_provenance.rs` / `.ts` recompute every anchor
  from frozen inputs and pin `0x716EA2F8` — the guardrail that was missing when
  the anchors first drifted.
- The genesis `first_proposal_hash` anchor hashes the canonical string
  `"Task 0090: Era 1040 - ZK-Notarized Mutations"`; the *live* bootstrap first
  proposal (`src/bootstrap/v2.ts`) submits a longer human-readable description,
  so the live proposal key (`0x55074120`) is not the frozen anchor
  (`0x30083117`). This is a content difference, not a hash bug.

## Hashing

- Senate/mitosis hashing is **SHA-256** (folded to u32) on both Rust and TS. The
  *outer* genesis inscription is still FNV-1a-32 over the anchor bytes (by
  design). Remaining FNV-1a in TS is non-consensus (`phi_bridge.emitIntent`,
  `compost_synapse.fastHash`, the `fnv1a` helper).

## Bare-metal spore (`omega_spore`)

- Builds for its bare-metal target (`cargo build --release
  --manifest-path omega_spore/Cargo.toml --target thumbv7em-none-eabihf` →
  a ~17 KB firmware binary). The `spore` feature omits the sanctuary/mitosis
  sweep (`lattice::darwinian_mitosis` + the `v2_mitosis_sweep` FFI export), which
  pulls in `codeicide_law`; the spore does not carry that path.

## Dev tools

- `tools/simulate_mesh.ts` — the deterministic autopoietic-flow simulator is
  bit-rotted: it calls the now-async `childReceiptHash` synchronously and uses
  retired FNV anchor constants. Not on the test/CI surface.
- `tools/generate_phase_goldens.ts` / `verify_phase_goldens.ts` import a deleted
  `phase_golden_common.ts` and are not referenced by any task — orphaned.

## ZK

- Completed **CPU** STARK proofs are checked in (`omega_zk_host/proofs/`,
  reverifiable). GPU/network proving is hardware-bound.
- `tests/mitosis_proof_zk_test.ts` and `tests/zk_physics_rollup_test.ts` expect
  a `"stark-mock"` bundle kind while the host defaults to `cpu`; they need
  re-anchoring to the current default (in the `test:integration`/zk tier).
- `sp1-sdk` (host) and `sp1-zkvm` (guest) are pinned to `=6.3.1`. Reproducing the
  guest build/proofs needs the SP1 toolchain (`cargo prove`).

## Mesh

- Relay store-and-forward is proven cross-machine; relay-store replication and
  DCUtR hole-punching (to upgrade "limited" relayed connections) are pending.
