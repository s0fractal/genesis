# omega_zk_host — checked-in STARK proofs

Real, verifiable SP1 STARK proof artifacts for OMEGA-64 mitosis events. These
are **not** mock bundles — each `kind` is `stark-cpu` and each was locally
verified by the same prover that generated it, then re-verified from disk.

For years the honest caveat in the parent README was "the cpu path is real but a
full proof has not been *completed* here" — SP1 cpu proving needs ~16 GB+ RAM and
OOMs on an 8 GB box. This directory closes that gap: a completed proof, on disk.

## Artifacts

| File | kind | receipt_hash | proof size | verified |
|------|------|--------------|-----------|----------|
| [`selftest_cpu.json`](selftest_cpu.json) | `stark-cpu` | `0x1b18eea0…520d9bd2` | 5,571,884 B | ✅ |
| [`arbitrary_cpu.json`](arbitrary_cpu.json) | `stark-cpu` | `0x965ca894…97266ad3` | 5,571,884 B | ✅ |
| [`rollup_cpu.json`](rollup_cpu.json) | `stark-cpu-rollup` | `0x0` (Mode 3) | 5,572,644 B | ✅ |
| `*.log` | — | prover stderr for each run | — | — |

Each `.json` re-verifies independently from disk via `--verify-only` (see below).

### 1 · `selftest_cpu.json` — Mode 2, canonical, no attractors
The canonical `--self-test` receipt: parent genome `0xCAFEBABE`, memory
`[0xDEADBEEF, 1, 2]`, `q_phase = 7`, **no attractors** → derivation takes the
epigenetic (xorshift) branch. The guest re-derives the mitosis child in-circuit
and the STARK attests that the claimed child + receipt hash follow from the
parent under the frozen physics.

### 2 · `arbitrary_cpu.json` — Mode 2, non-canonical, **with a dominant attractor**
A deliberately *different* birth event (emitted by `--emit-receipt`): parent
genome `0xA5A51234`, memory `[0x0BADF00D, 7, 11]`, energy `4200`, plus **one
dominant attractor** (`matrix = 64`). Its phase sits on the parent's, so the
derivation takes the **`birth_near_attractor` branch** (`child.genome =
parent.genome ^ matrix = 0xA5A51274`, and the `0x01000000` flag is set) — a part
of the guest circuit the self-test never exercises. Proves the prover is not
pinned to one fixture: an arbitrary, attractor-driven receipt proves and
verifies just the same.

### 3 · `rollup_cpu.json` — Mode 3, ZK physics rollup (4 agents)
A `--rollup-test` proof: instead of a single mitosis event, the guest folds a
whole physics tick over a 4-agent snapshot (Mode 3), attesting the initial→final
state transition. `kind` is `stark-cpu-rollup`; `receipt_hash`/`parent_genome`
are `0x0` by design (a rollup attests a state transition, not one birth).

## Provenance

- **Generated:** 2026-07-07, macOS (darwin arm64), 48 GB RAM.
- **Prover:** SP1 `cargo-prove` v6.3.1, `SP1_PROVER=cpu` (real local STARK — no
  GPU, no network, no spend).
- **Guest ELF:** `riscv64im-succinct-zkvm-elf`, 166,400 bytes (built with
  `cargo prove build`; content-addressable — peers verify against the same ELF).
- **Commands (one per artifact):**
  ```sh
  # 1 · canonical self-test (Mode 2, no attractors)
  SP1_PROVER=cpu ./target/release/omega_zk_host --self-test > proofs/selftest_cpu.json

  # 2 · arbitrary receipt (Mode 2, non-canonical parent + dominant attractor)
  ./target/release/omega_zk_host --emit-receipt > proofs/arbitrary_receipt.json
  SP1_PROVER=cpu ./target/release/omega_zk_host < proofs/arbitrary_receipt.json > proofs/arbitrary_cpu.json

  # 3 · physics rollup (Mode 3, 4-agent snapshot)
  SP1_PROVER=cpu ./target/release/omega_zk_host --rollup-test > proofs/rollup_cpu.json
  ```
  `arbitrary_receipt.json` is the (small, human-readable) input; `--emit-receipt`
  derives the child with the same pure function the guest uses, so the receipt is
  valid by construction.

## Verify it yourself

Re-verify any checked-in proof directly — fast, no re-proving (needs the built
host binary and the same guest ELF):

```sh
cd omega_zk_host
for f in selftest_cpu arbitrary_cpu rollup_cpu; do
  SP1_PROVER=cpu ./target/release/omega_zk_host --verify-only < proofs/$f.json
done
# → [zk_host] ✅ Verification succeeded.   ("verified": true)  ×3
```

Or regenerate from scratch on any ≥16 GB machine (minutes) and confirm no
regression to mock:

```sh
SP1_PROVER=cpu cargo test -p omega_zk_host --test real_proof -- --ignored --nocapture
```

Trust the hash, not the host.
