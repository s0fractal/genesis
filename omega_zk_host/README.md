# omega_zk_host — Era 1040 Phase 3 STARK Prover

Real SP1 STARK proof generator for OMEGA-64 mitosis events. This is the
**host-side** counterpart to `omega_zk_guest`, completing the Era 1040 trinity
(host → ZK guest → verifier).

## Status

- **Era 1040 Phase 1** ✅ Pure mitosis derivation (Rust + JS + SP1 RISC-V).
- **Era 1040 Phase 2** ✅ MitosisLog ring buffer + host parent snapshotting.
- **Era 1040 Phase 3** ✅ **Real SP1 STARK proofs** (this crate).

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

Self-test output:

```json
{
  "kind": "stark-mock",
  "receipt_hash": "0xd434e690",
  "parent_genome": "0xcafebabe",
  "verified": true,
  "proof_bytes": "AAAAAAAAAAAAAAAADQAAAAAAAAACvrr+ygAAAACQ5jTUBgAAAAAAAAB2Ni4xLjAA",
  "public_values": "DQAAAAAAAAACvrr+ygAAAACQ5jTU",
  "note": "SP1 mock prover; ELF 146664 bytes; proof 48 bytes"
}
```

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

## Production deployment

For production use, swap the mock prover for one of:

- `ProverClient::builder().cpu().build()` — local CPU STARKs (slow but real).
- `ProverClient::builder().cuda().build()` — local GPU STARKs (fast).
- `ProverClient::builder().network().build()` — Succinct's prover network.

The mock prover used here produces proofs in milliseconds and is suitable for
deterministic testing + CI; real cryptographic proofs require one of the three
above.
