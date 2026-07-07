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
| [`selftest_cpu.log`](selftest_cpu.log) | — | prover stderr for the run above | — | — |

`selftest_cpu.json` is the canonical `--self-test` receipt: parent genome
`0xCAFEBABE`, memory `[0xDEADBEEF, 1, 2]`, `q_phase = 7`, no attractors. The
guest re-derives the mitosis child in-circuit and the STARK attests that the
claimed child + receipt hash follow from the parent under the frozen physics.

## Provenance

- **Generated:** 2026-07-07, macOS (darwin arm64), 48 GB RAM.
- **Prover:** SP1 `cargo-prove` v6.3.1, `SP1_PROVER=cpu` (real local STARK — no
  GPU, no network, no spend).
- **Guest ELF:** `riscv64im-succinct-zkvm-elf`, 166,400 bytes (built with
  `cargo prove build`; content-addressable — peers verify against the same ELF).
- **Command:**
  ```sh
  SP1_PROVER=cpu ./target/release/omega_zk_host --self-test > proofs/selftest_cpu.json
  ```

## Verify it yourself

Re-verify the checked-in proof directly — fast, no re-proving (needs the built
host binary and the same guest ELF):

```sh
cd omega_zk_host
SP1_PROVER=cpu ./target/release/omega_zk_host --verify-only < proofs/selftest_cpu.json
# → [zk_host] ✅ Verification succeeded.   ("verified": true)
```

Or regenerate from scratch on any ≥16 GB machine (minutes) and confirm no
regression to mock:

```sh
SP1_PROVER=cpu cargo test -p omega_zk_host --test real_proof -- --ignored --nocapture
```

Trust the hash, not the host.
