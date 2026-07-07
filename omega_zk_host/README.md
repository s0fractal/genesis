# omega_zk_host — Era 1040 Phase 3 STARK Prover

Real SP1 STARK proof generator for OMEGA-64 mitosis events. This is the
**host-side** counterpart to `omega_zk_guest`, completing the Era 1040 trinity
(host → ZK guest → verifier).

## Status

- **Era 1040 Phase 1** ✅ Pure mitosis derivation (Rust + JS + SP1 RISC-V).
- **Era 1040 Phase 2** ✅ MitosisLog ring buffer + host parent snapshotting.
- **Era 1040 Phase 3** ✅ **Real SP1 STARK proofs** (this crate).
- **Completed `cpu` proof checked in** ✅ (2026-07-07) — a real `stark-cpu`
  proof of the canonical self-test receipt was generated and locally verified on
  a 48 GB machine, then independently re-verified from disk via `--verify-only`.
  The 5.57 MB bundle lives at [`proofs/selftest_cpu.json`](proofs/); see
  [`proofs/README.md`](proofs/README.md). The `real_proof.rs` gate reproduces it.

## Why a separate workspace

`sp1-sdk` pulls a large dependency tree (ethers, reqwest, tokio, etc.) we do NOT
want to inflict on the workspace's `cargo test` cycle. This crate opts out of
the root workspace via `[workspace]` in its `Cargo.toml` and lives standalone.

## Setup

```bash
# Install the SP1 toolchain (one-time):
curl -L https://sp1up.succinct.xyz | bash
source ~/.zshenv      # or ~/.bashrc
sp1up                 # installs cargo-prove + the succinct rust toolchain

# Build the ZK guest ELF (riscv64im-succinct-zkvm-elf):
cd omega_zk_guest && cargo prove build

# Build this host prover (links the ELF via include_bytes!):
cd omega_zk_host && cargo build --release
```

## Usage

```bash
# Self-test (uses canonical 0xCAFEBABE parent → 0xD434E690 receipt):
./target/release/omega_zk_host --self-test

# Prove an arbitrary receipt (JSON via stdin):
cat receipt.json | ./target/release/omega_zk_host
```

Real self-test output (`SP1_PROVER=cpu`, from the checked-in
[`proofs/selftest_cpu.json`](proofs/selftest_cpu.json) — `proof_bytes` and
`public_values` truncated here; the real proof is 5.57 MB, minutes to generate):

```json
{
  "kind": "stark-cpu",
  "receipt_hash": "0x1b18eea01f2ffa41fa9398e6a098583b4cc4e83d85a90586323cca92520d9bd2",
  "parent_genome": "0xcafebabe",
  "verified": true,
  "proof_bytes": "AAAAAAQAAAAAAAAAuwAAAAAAAAAA…(≈7.4 MB base64)…",
  "public_values": "…",
  "note": "SP1 cpu prover; ELF 166400 bytes; proof 5571884 bytes"
}
```

(`SP1_PROVER=mock` still works for fast/unsound dev — its bundle is tiny, a few
dozen proof bytes, and its `kind` is `stark-mock` so nobody mistakes it for the
real thing.)

The `receipt_hash` and `parent_genome` echoed in the bundle are **the canonical
cross-language anchors** — `0xD434E690` (mitosis no-attractor) and `0xCAFEBABE`
(test parent genome). The proof itself is verified by the same prover that
generated it; in production, peers would verify proofs they receive against the
same ELF (which is content-addressable).

## Pipeline

```
┌─────────────────────┐
│ MitosisLog (Rust)   │
│ static ring buffer  │
└──────────┬──────────┘
           │ FFI v2_mitosis_log_ptr
           ▼
┌─────────────────────┐
│ JS drainMitosisLog  │
│ (browser/Deno)      │
└──────────┬──────────┘
           │ JSON receipt
           ▼
┌─────────────────────┐
│ omega_zk_host       │  ← THIS CRATE
│ - re-derive locally │
│ - feed SP1 stdin    │
│ - generate STARK    │
│ - verify locally    │
│ - emit proof bundle │
└──────────┬──────────┘
           │ proof bundle (base64 JSON)
           ▼
┌─────────────────────┐
│ Mesh peers / chain  │
│ verify against ELF  │
└─────────────────────┘
```

## Prover modes (`SP1_PROVER`)

The prover is chosen at runtime from the `SP1_PROVER` env var (SP1's own
convention) — the host calls `ProverClient::from_env()`, and **the default is
real**:

- `cpu` (DEFAULT) — a real local STARK; no GPU, no network, no spend. Slow and
  RAM-heavy: a full proof needs ~16 GB+ RAM and minutes of proving, and OOMs on
  an 8 GB box. **This is now completed, not just wired:** a full `stark-cpu`
  proof was generated and verified on a 48 GB machine and the bundle is checked
  in (see [`proofs/`](proofs/)). Reproduce it on any ≥16 GB machine; use
  `network` if you have neither the RAM nor the patience.
- `mock` — fast, deterministic, **NOT cryptographically sound**; for tests/CI
  only. (This was previously the only backend — that is no longer true.)
- `network` — Succinct's prover network (needs `NETWORK_PRIVATE_KEY`; paid).

The proof bundle's `kind` field reports the active mode (`stark-cpu` /
`stark-mock` / `stark-network`), so a consumer never reads more soundness into a
proof than the prover that produced it.

### Validating a real proof (≥16 GB machine)

`tests/real_proof.rs` is the completion of the real-prover work that an 8 GB box
cannot run, so it is `#[ignore]`d (a normal `cargo test` skips it and never
OOMs). It was **run green on a 48 GB machine on 2026-07-07** (`stark-cpu`,
`verified: true`, not mock), producing the checked-in [`proofs/`](proofs/)
bundle. On adequate hardware, re-run it to confirm omega still generates a real,
verified STARK and has not silently regressed to mock:

```sh
SP1_PROVER=cpu cargo test -p omega_zk_host --test real_proof -- --ignored --nocapture
```

To re-verify the checked-in artifact directly (fast — no re-proving):

```sh
SP1_PROVER=cpu ./target/release/omega_zk_host --verify-only < proofs/selftest_cpu.json
```
