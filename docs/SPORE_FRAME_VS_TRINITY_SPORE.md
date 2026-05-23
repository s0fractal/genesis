# Omega lowercase `spore` is **not** Trinity capital `SPORE`

## Why this file exists

Two unrelated artifacts in this ecosystem share the substring `spore`:

1. **Omega lowercase `spore_*`** (this repo) — bare-metal firmware, 32-byte mesh
   frames, no_std witness device lineage.
2. **Trinity capital `SPORE.v0`** (sibling repo, `trinity/contracts/`) — pinned
   content-addressed deterministic apply protocol.

A 2026-05-14 trinity-level deep analysis report conflated them, treating Omega
as the "compute engine" for Trinity SPORE. That is wrong. This file records the
distinction so the next reader can keep them apart without reading chord
history.

## What Omega `spore_*` actually is

A witness device lineage. Era 1100+. Carries telemetry over UART/SPI/BLE between
bare-metal devices and relay nodes.

| File                                  | Role                                                                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `omega/omega_v2/src/spore_frame.rs`   | 32-byte mesh frame layout. Magic `0x4F46` ('OF'). FNV-1a CRC. Frame types 1..6 (warrant_vote, halo_state, heartbeat, quorum_query, snapshot_digest, composite_health, etc.) |
| `omega/omega_v2/src/spore_runner.rs`  | Main loop glue + wire driver hook (UART/SPI/BLE abstraction). Drains RX, parses 32-byte frames, routes by `frame_type`.                                                     |
| `omega/omega_v2/src/spore_routing.rs` | Mesh routing for spore frames.                                                                                                                                              |
| `omega/omega_spore/`                  | Era 1100 Bare-Metal Spore: 6 KB Cortex-M4F firmware. Validates OMEGA-64 v1.0 anchors at boot. Cross-compiles to `thumbv7em-none-eabihf`.                                    |

Concern: **physical mesh telemetry, warrant votes, halo state, heartbeats,
snapshot digests, composite mesh health, post-mortem quorum verdicts**.

## What Trinity `SPORE.v0` is

A backend-agnostic apply protocol for byte-to-byte deterministic mutation.

```text
apply(mutator_hash, input_hashes...) → output_hash / spore_id / receipt
```

Owner: Trinity contracts. Wire format: `SPOR` magic, `kind=apply`, multihash
entries. Bootstrap pin: `SPORE_BOOTSTRAP_PIN.v0` (51 files, Bitcoin
OpenTimestamps). Runtime: backend-pluggable (wasmtime, deno V8, future
omega-zk).

Lives in:

- `trinity/contracts/SPORE.v0.draft.md`
- `trinity/contracts/SPORE_BOOTSTRAP_PIN.v0.md`
- `trinity/contracts/SPORE_FUEL.v1.draft.md`
- `trinity/contracts/SPORE_VS_OMEGA_SPORE_BOUNDARY.v0.1.md` ← **the
  authoritative boundary doc**

## Where they can bridge

An Omega `spore_frame` of `frame_type = SNAPSHOT_DIGEST` (type 5) may carry the
`spore_id` of a Trinity `SPORE.v0` receipt as part of mesh telemetry — the mesh
witnesses that a receipt was anchored. This is a **bridge**, not identity.

A future Omega ZK proof backend (SP1) may serve as **one of several** SPORE.v0
apply runtimes — alongside wasmtime and deno. It would be
`backend_kind: "omega-zk"`, with `protocol_owner: "trinity"`. Omega does not own
the protocol.

## Forbidden moves

- Renaming `spore_frame.rs` to claim it implements SPORE.v0 wire format.
- Treating the 32-byte Omega frame as the SPORE.v0 `apply` record (different
  magic, different fields, different execution model).
- Moving SPORE.v0 protocol contracts into `omega/` (they remain Trinity-level
  shared protocol).
- Exporting `v2_spore_apply` from `omega_v2_core.wasm` as **the** canonical
  SPORE owner. It may be **one backend among many**; the protocol is owned by
  Trinity.

## See also

- `trinity/contracts/SPORE_VS_OMEGA_SPORE_BOUNDARY.v0.1.md` — full boundary
  contract.
- `trinity/docs/SHAPE_MAP.v0.md` — one-page ecosystem shape.
- `trinity/jazz/chords/2026-05-14T154732Z-codex-aye-spore-protocol-vs-omega-spore-boundary.md`
  — chord that surfaced the distinction.
