# omega_zk_host — checked-in STARK proofs

Real, verifiable SP1 STARK proof artifacts for OMEGA-64 mitosis events. These
are **not** mock bundles — each `kind` is `stark-cpu` and each was locally
verified by the same prover that generated it, then re-verified from disk.

For years the honest caveat in the parent README was "the cpu path is real but a
full proof has not been _completed_ here" — SP1 cpu proving needs ~16 GB+ RAM
and OOMs on an 8 GB box. This directory closes that gap: a completed proof, on
disk.

## A proof is about ONE program (read this before trusting the table)

An SP1 verifying key is derived from the guest ELF, so a bundle attests exactly
the circuit it was proved against — and the ELF is a build artifact under
`target/`, not a file in this repository.

**These bundles were unverifiable for most of July and nothing noticed.** T3
made `alpha` a wire field of Mode 3; that changed the guest; and from then on
all three failed with
`verification failed: Core(invalid public values: pc_start !=
vk.pc_start)` —
while this file said they "re-verify independently from disk" and
`docs/KNOWN_GAPS.md` said "reverifiable". The claim was not checked because
nothing ran it. That is now a CI job (`zk_host` in `.github/workflows/ci.yml`),
which rebuilds the guest and re-verifies every bundle here on every push.

Two things changed so the failure can never again be silent or confusing:

1. **Each bundle carries a `program` block** — the verifying-key hash, the
   SHA-256 of the guest ELF, and its byte length. `--verify-only` compares it
   _before_ asking SP1 to verify, so program drift is reported as program drift
   instead of as `pc_start != vk.pc_start`, which is accurate and tells a reader
   nothing. Before this, the only trace of the guest was a note reading "ELF
   166400 bytes", and a byte count is not an identity.
2. **Each bundle carries a `physics` block** — the parameters the proof actually
   constrained (`alpha` for Mode 3 rollups, `q_phase`), so a proof states which
   coupling law it proved rather than being assumed to have proved the canonical
   one. That assumption is exactly what T3 found broken.

Bundles generated before 2026-08-02 have neither block; `--verify-only` says so
rather than treating their absence as a match.

The guest build is byte-reproducible — measured, three consecutive
`cargo prove
build` runs of unchanged sources produced an identical ELF — so
rebuilding gives the same verifying key, and a mismatch means the bundles are
stale relative to the source rather than that the build is noisy.

## Artifacts

| File                                       | kind               | receipt_hash          | proof size  | verified |
| ------------------------------------------ | ------------------ | --------------------- | ----------- | -------- |
| [`selftest_cpu.json`](selftest_cpu.json)   | `stark-cpu`        | `0x1b18eea0…520d9bd2` | 5,571,884 B | ✅       |
| [`arbitrary_cpu.json`](arbitrary_cpu.json) | `stark-cpu`        | `0x965ca894…97266ad3` | 5,571,884 B | ✅       |
| [`rollup_cpu.json`](rollup_cpu.json)       | `stark-cpu-rollup` | `0x0` (Mode 3)        | 5,572,648 B | ✅       |

All three attest the same program:

|               |                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------- |
| verifying key | `0x0079cd08d3f3cdb0…` (full value in each bundle's `program.vkey`)                       |
| guest ELF     | 167,120 bytes, sha256 `92aa1f64437c6813b460aab25c5024cd459c2ea25c48b733aec51cddc1a60cfd` |
| physics       | `q_phase 7` (Mode 2) · `alpha 64, q_phase 8` (Mode 3 rollup)                             |
| `*.log`       | —                                                                                        |

Each `.json` re-verifies independently from disk via `--verify-only` (see
below).

### 1 · `selftest_cpu.json` — Mode 2, canonical, no attractors

The canonical `--self-test` receipt: parent genome `0xCAFEBABE`, memory
`[0xDEADBEEF, 1, 2]`, `q_phase = 7`, **no attractors** → derivation takes the
epigenetic (xorshift) branch. The guest re-derives the mitosis child in-circuit
and the STARK attests that the claimed child + receipt hash follow from the
parent under the frozen physics.

### 2 · `arbitrary_cpu.json` — Mode 2, non-canonical, **with a dominant attractor**

A deliberately _different_ birth event (emitted by `--emit-receipt`): parent
genome `0xA5A51234`, memory `[0x0BADF00D, 7, 11]`, energy `4200`, plus **one
dominant attractor** (`matrix = 64`). Its phase sits on the parent's, so the
derivation takes the **`birth_near_attractor` branch**
(`child.genome =
parent.genome ^ matrix = 0xA5A51274`, and the `0x01000000` flag
is set) — a part of the guest circuit the self-test never exercises. Proves the
prover is not pinned to one fixture: an arbitrary, attractor-driven receipt
proves and verifies just the same.

### 3 · `rollup_cpu.json` — Mode 3, ZK physics rollup (4 agents)

A `--rollup-test` proof: instead of a single mitosis event, the guest folds a
whole physics tick over a 4-agent snapshot (Mode 3), attesting the initial→final
state transition. `kind` is `stark-cpu-rollup`; `receipt_hash`/`parent_genome`
are `0x0` by design (a rollup attests a state transition, not one birth).

## Provenance

- **Generated:** 2026-08-02, macOS (darwin arm64, M4 Pro), 48 GB RAM.
  (Regenerated from 2026-07-07 originals, which attested a pre-T3 guest and no
  longer verified. The receipt hashes are unchanged — `0x1b18eea0…` and
  `0x965ca894…` — because the physics did not change; only the program did.)
- **Prover:** SP1 `cargo-prove` v6.3.1, `SP1_PROVER=cpu` (real local STARK — no
  GPU, no network, no spend).
- **Guest ELF:** `riscv64im-succinct-zkvm-elf`, 167,120 bytes, sha256
  `92aa1f64…a60cfd` (built with `cargo prove build`). A peer verifies by
  rebuilding it from the same sources with the same pinned toolchain — the build
  is reproducible, and each bundle's `program` block says which ELF it needs, so
  a mismatch is named rather than guessed at.
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
  `arbitrary_receipt.json` is the (small, human-readable) input;
  `--emit-receipt` derives the child with the same pure function the guest uses,
  so the receipt is valid by construction.

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
