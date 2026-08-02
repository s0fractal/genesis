# omega_zk_host — Era 1040 Phase 3 STARK Prover

Real SP1 STARK proof generator for OMEGA-64 mitosis events. This is the
**host-side** counterpart to `omega_zk_guest`, completing the Era 1040 trinity
(host → ZK guest → verifier).

## Status

- **Era 1040 Phase 1** ✅ Pure mitosis derivation (Rust + JS + SP1 RISC-V).
- **Era 1040 Phase 2** ✅ MitosisLog ring buffer + host parent snapshotting.
- **Era 1040 Phase 3** ✅ **Real SP1 STARK proofs** (this crate).
- **Completed `cpu` proofs checked in** ✅ (regenerated 2026-08-02) — three
  real, independently re-verifiable STARKs generated and verified on a 48 GB
  machine: `selftest_cpu` (Mode 2, canonical), `arbitrary_cpu` (Mode 2,
  non-canonical parent **+ dominant attractor** — a branch the self-test never
  hits), and `rollup_cpu` (Mode 3, 4-agent physics rollup). All in
  [`proofs/`](proofs/); see [`proofs/README.md`](proofs/README.md). The
  `real_proof.rs` gate reproduces the self-test one.

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

# The guest ELF is CHECKED IN at omega_zk_guest/elf/ and the host embeds those
# exact bytes — an SP1 proof is about one program, and `cargo prove build` is
# byte-reproducible within a platform but NOT across one (macOS 167,120 B vs the
# ubuntu runner's 167,040 B, different verifying key). So building the guest is
# only needed when you CHANGE it; the ELF, the guest sources and the bundles in
# proofs/ then move together.
cd omega_zk_guest && cargo prove build   # only when changing the guest
cp ../target/elf-compilation/riscv64im-succinct-zkvm-elf/release/omega_zk_guest \
   elf/omega_zk_guest                    # then regenerate proofs/ — see proofs/README.md

# Build this host prover (links the committed ELF via include_bytes!):
cd omega_zk_host && cargo build --release
```

## Usage

```bash
# Self-test (canonical 0xCAFEBABE parent, no attractors):
./target/release/omega_zk_host --self-test

# Prove an arbitrary receipt (JSON via stdin):
cat receipt.json | ./target/release/omega_zk_host

# Emit a valid non-canonical receipt (different parent + a dominant attractor),
# then prove it — no need to hand-craft JSON:
./target/release/omega_zk_host --emit-receipt | ./target/release/omega_zk_host

# Prove a Mode 3 physics rollup over a 4-agent snapshot:
./target/release/omega_zk_host --rollup-test
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
  "note": "SP1 cpu prover; ELF 167120 bytes; proof 5571884 bytes",
  "program": {
    "vkey": "0x0079cd08d3f3cdb0…",
    "elf_sha256": "92aa1f64437c6813…",
    "elf_bytes": 167120
  },
  "physics": { "q_phase": 7 }
}
```

(`SP1_PROVER=mock` still works for fast/unsound dev — its bundle is tiny, a few
dozen proof bytes, and its `kind` is `stark-mock` so nobody mistakes it for the
real thing.)

`parent_genome` echoes the canonical test parent `0xCAFEBABE`. `receipt_hash` is
a **SHA-256** (64 hex) — this paragraph used to name `0xD434E690` as the value
in the bundle, which is an 8-hex u32 from the pre-SHA-256 era and has not been
what the bundle carries since the FNV→SHA-256 migration. (T7 corrected that
class of stale comment in five modules; this file was missed.) The historical
u32 anchors still stand as history and are recorded in
`docs/A_LETTER_TO_FUTURE_ORACLES.md`.

The proof is verified by the same prover that generated it, and re-verified from
disk by CI against the **committed** guest ELF (`omega_zk_guest/elf/`). That is
what lets a peer verify a proof it receives: the ELF is in the tree and each
bundle's `program.elf_sha256` names the bytes it needs, so verification no
longer depends on having built the guest on the prover's own platform.

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
OOMs). It was **run green on a 48 GB machine** (`stark-cpu`, `verified: true`,
not mock); the checked-in [`proofs/`](proofs/) bundles were last regenerated
2026-08-02, after T3 changed the guest circuit and left the previous ones
attesting a program that no longer existed. On adequate hardware, re-run it to
confirm omega still generates a real, verified STARK and has not silently
regressed to mock:

```sh
SP1_PROVER=cpu cargo test -p omega_zk_host --test real_proof -- --ignored --nocapture
```

To re-verify the checked-in artifact directly (fast — no re-proving):

```sh
SP1_PROVER=cpu ./target/release/omega_zk_host --verify-only < proofs/selftest_cpu.json
```
