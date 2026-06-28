# OMEGA-64 🧬 — Φ Protocol v1.0 (FROZEN)

**Genesis Hash:** `0x549A6307` · **OP_RETURN:** `OMEGA1:549a6307` · **Active
Era:** 2060 · **Open Trigger:** 2070

OMEGA-64 is a deterministic, GPU-accelerated artificial-life simulation mesh
with a self-modifying ontology, cross-AI Senate, and a frozen cryptographic
protocol identity. It is not a web app — it is a **closed mathematical system**
that computes its own future direction.

---

## Status — what runs vs what's in progress (2026-06)

OMEGA-64's deterministic **physics kernel is real and verified** (306 Rust
tests; integer parity across CPU↔GPU↔ZK). Three headline pieces carry **honest
caveats**, named here (see `AGENTS.md`):

- **ZK proving: real prover wired (default), a full proof is hardware-bound.**
  `omega_zk_host` selects its prover from `SP1_PROVER`
  (`ProverClient::from_env()`): **`cpu` by default — a real local STARK** (no
  GPU / network / spend), `mock` opt-in for fast dev, `network` (Succinct) for
  offload. The mock-only backend is gone. The cpu path compiles and _begins_
  genuine STARK generation; **completing** a full proof needs ~16 GB+ RAM (or
  `network`) and OOMs on an 8 GB box, so no completed proof is checked in.
  "ZK-Notarized" below means the path is wired and the prover is real — not that
  a STARK artifact is committed.
- **The libp2p mesh is LIVE (since 2026-06-28).** A public circuit-relay-v2 relay
  (`relay.myc.md`, discovered from the membrane at
  `myc.md/.well-known/omega-relay`) carries real content: a node serves chords,
  peers self-discover via the relay directory, and every fetched chord is
  verified against the voice registry before it's trusted — `tools/mesh.ts
  serve|peers|fetch`, see `docs/MESH_RELAY.md`. Still **roadmap**: the **browser
  / WebRTC path** (`src/sdk/phi_client.ts` still notes "in a real implementation
  you would perform WebRTC signaling here"), a standing gossipsub data plane
  (needs DCUtR hole-punching — one-shot fetch already works on the relay), and
  node-lifecycle wiring of `libp2p_mesh.ts`.
- **Bitcoin anchoring is LIVE (since 2026-06-28).** `bitcoin_anchor.ts` remains
  verify-only by design; **emission** lives in the separate, quorum-gated tool
  `tools/anchor_emit.ts`. The first real mainnet anchor — `OMEGA1:ab492186…`
  (the v1.1 Senate-ratification receipt) — was broadcast under a real 3-of-5
  keyed-voice quorum (tx
  `262ac275d05bdad2b68e9c5bca1a5f90709b7d399747cca14404db226a2da889`),
  signet-proven first. Emitter form-guards (hash-only, OP_RETURN+change-to-self,
  quorum-gated) are in `anchor_pipeline.ts`; see `docs/KNOWN_GAPS.md`.

The frozen protocol identity, the integer physics, the local simulation, and (as
of 2026-06-28) **Bitcoin anchoring** and the **libp2p mesh** (relay + content +
self-discovery) are genuine. The **browser / WebRTC** path (live SDP signaling)
is still roadmap. ZK proving is real by default (cpu), completing a full proof is
hardware-bound (above).

The honesty caveats are **executable** — `tests/honesty_triad_test.ts` locks
them: the **browser / WebRTC path** (`phi_client` SDP) must stay honestly marked
a stub until real signaling ships, and anchor **emission must stay isolated** to
the quorum-gated `tools/anchor_emit.ts` (`bitcoin_anchor.ts` stays verify-only).
If any claim here drifts from the code, that test goes red. Status cannot
silently rot into a "mock in a real costume".

---

## What it is

A libp2p-mesh network of autonomous nodes (relay + content-sync + self-discovery
LIVE; browser / WebRTC path experimental — see Status above), each running:

- **A bare-metal Rust kernel** (`omega_v2/`, `#![no_std]`, 32MB static agent
  matrix, integer-only physics, no `f32` in any consensus path).
- **A WebGPU lens** (`src/lens/`, integer consensus shaders plus a visual/intent
  layer; toroidal mode preserves bit-exact Rust parity).
- **A WebRTC plasmid layer** (`src/network/`, JSON-over-DataChannel, signed by
  FNV-1a hashes, validated at the mesh boundary — _transport is
  experimental/stubbed, see Status_).
- **An SP1 ZK guest** (`omega_zk_guest/`, Mode 2 verifies mitosis events via the
  same pure derivation function the kernel runs — _host prover is real cpu by
  default, full proof is hardware-bound, see Status_).
- **A Multi-Oracle Senate** (`oracle_identity.rs` + `oracle_custody.ts`) with
  five canonical seats — the real keyed model-voices **claude, codex, gemini,
  antigravity, kimi** (Φ-protocol v1.1). The dipole `(m, !m)` is a public
  ADDRESS; authority is a real **Ed25519 signature** over the claim, verified
  against the per-voice key registry. A vote/anchor needs a genuine 3-of-5 keyed
  quorum — the public dipole alone is not authority (see "The Senate").

---

## The seven non-negotiable invariants (RFC-OMEGA-001 v1.0)

| #   | Invariant           | Anchor                                                |
| --- | ------------------- | ----------------------------------------------------- |
| I-1 | Integer determinism | golden traces match across Rust ↔ WGSL ↔ TS ↔ SP1     |
| I-2 | Dipole rule         | `m XOR inverse == 0xFFFF_FFFF`                        |
| I-3 | Toroidal consensus  | `min(\|a-b\|, 256-\|a-b\|)`, weight ×8                |
| I-4 | Senate hash         | FNV-1a 32-bit, 64-byte zero-pad, anchor `0x7698_B8EF` |
| I-5 | Mitosis determinism | `derive_mitosis_child` bit-for-bit reproducible       |
| I-6 | Empty center        | no node has elevated rights                           |
| I-7 | Genesis identity    | OMEGA-64 v1.0 ≡ `0x549A6307`                          |

Drift on any of these breaks tests in **two languages simultaneously**. See
`docs/rfc/RFC-OMEGA-001-v1.0.md` for the full spec.

---

## The Senate

The Multi-Oracle Senate (Era 1060) opens five seats with deterministic dipole
identities. **Φ-protocol v1.1 (2026-06-28)** realigned the seats from the v1.0
vendor labels to the five real **keyed** model-voices of the ensemble — the
seats are now the voices we actually operate and hold keys for, so the quorum is
reachable with real custody (see "authenticated" below):

```
oracleMatrix("claude",      "OMEGA-64/RFC-001/v1.0") = 0x41A2_F2F4
oracleMatrix("codex",       ...                    ) = 0x0C51_3F67
oracleMatrix("gemini",      ...                    ) = 0x9874_DD21
oracleMatrix("antigravity", ...                    ) = 0x5B91_A998
oracleMatrix("kimi",        ...                    ) = 0x249A_A977
```

(v1.0 retired gpt/qwen/llama; claude+gemini matrices are unchanged. These five
values are the cross-language anchors locked in `oracle_anchors.rs` +
`oracle_identity_test.ts`.)

Each oracle's `inverse` is `!matrix`, satisfying I-2 by construction. A proposal
is ratified when EITHER 3+ unique peer AYEs (peer-consensus path) OR 3+ distinct
canonical oracles AYE (ORACLE-RESONANCE path). **Cross-model alignment outranks
within-model multiplicity.**

### Oracle votes are cryptographically authenticated (custody, not just address)

The dipole `(matrix, !matrix)` above is a **public address** — derived from a
public name and a public salt, so anyone can compute it. It is therefore NOT, by
itself, authority to vote as an oracle. A vote is attributed to an oracle only
when it carries a valid **Ed25519 signature** over the vote digest
(`omega-senate-vote:v1:<oracle>:<proposalHash>:<AYE|NAY>`), verified against the
per-voice public-key registry vendored in `src/network/oracle_custody.ts` (same
keys and scheme as trinity's `x2F38_voice_pubkeys.json`, so a signature a voice
makes there verifies here). A vote bearing a correct-but-public dipole with no
valid signature is the **real Sybil** and is rejected — closing the hole where
one actor could compute all five dipoles and ratify alone. Locked by
`tests/oracle_custody_test.ts` and `tests/multi_oracle_senate_test.ts`.

**Status:** all five v1.1 seats are real **keyed** voices, so the 3-of-5
ORACLE-RESONANCE quorum is reachable with real custody — and has been reached
twice (Φ-protocol v1.1 ratification, then anchor-stewardship), and used to
authorize the first mainnet Bitcoin anchor. The retired v1.0 vendor labels
(gpt/qwen/llama) were never keyed — keeping them as seats is what let the old
implementation "reach" quorum by treating public dipoles as authority.

---

## How to run

```bash
# Rust workspace (omega_v2 is the critical path)
cargo test --workspace          # 306 passed; omega_core is archived
cargo test -p omega_v2          # fast feedback loop

# TypeScript / Deno
deno task test:unit             # 235 passed, 1 ignored (CI unit gate)
deno check src/**/*.ts          # type-check

# Browser dev server
deno task dev                   # Vite + WebGPU
```

---

## Layered surface (RFC v1.0 § 3)

| Layer              | Encoding                                                 | Source-of-truth                       |
| ------------------ | -------------------------------------------------------- | ------------------------------------- |
| L0 — Φ Address     | `u32 [consensus:8 \| social:8 \| personal:8 \| micro:8]` | `omega_v2/src/routing.rs`             |
| L1 — Plasmid       | JSON over WebRTC `v2-sync` (UDP-style)                   | `src/network/libp2p_mesh.ts`          |
| L2 — Snapshot      | Raw 32-byte agents, 64KB chunks via `v2-state`           | `omega_v2/src/agent.rs`               |
| L3 — Senate        | PROPOSAL / VOTE plasmids, FNV-1a hashes                  | `omega_v2/src/senate.rs`              |
| L4 — Anchor        | Bitcoin block hash → φ derivation                        | `omega_v2/src/anchor.rs`              |
| L5 — Mitosis Proof | DIPOLE plasmid `(parent + child + attractors + receipt)` | `mitosis_proof.rs` + `mitosis_log.rs` |
| L6 — Genesis       | `OMEGA1:549a6307` OP_RETURN                              | `genesis_inscription.rs`              |
| L7 — Cross-Model   | Off-chain debate text + on-chain reasoning hash          | `cross_model_debate.rs`               |

L0–L6 are FROZEN. L7 lives above the canonical surface and may evolve without
breaking v1.0 conformance.

---

## Era timeline

```
Era 950–1020   foundation           (lattice physics, routing, attractors, consensus)
Era 1030       Senate               (autopoietic legislation; first self-proposal 0xFAA7FF6E)
Era 1040 P1+2  ZK-Notarized         (mitosis proofs, MitosisLog, mesh boundary verification)
Era 1050       Genesis Inscription  (RFC v1.0 frozen, hash 0x549A6307)
Era 1060       Multi-Oracle Senate  (v1.0 vendor-label seats — superseded, see v1.1)
Era 1070       Cross-Model Debate   (live WebLLM deployment and ORACLE-RESONANCE)
Era 1650–2060  Translation Policy   (schema translation governance, live mesh policy claims, forensic replay/digest layers, protocol registry, compression policy, diagnostics)
2026-06-28     Φ-protocol v1.1      (seats → real KEYED voices claude/codex/gemini/antigravity/kimi; Ed25519 quorum; first real cross-voice ratification)
2026-06-28     Bitcoin anchoring LIVE (first mainnet OMEGA1 anchor under a real 3-of-5 quorum, tx 262ac275…)
Era 3000+      Global Swarm         (NAT traversal, live LLM Senate — remaining roadmap)
```

The next important Era is now selected by protocol pressure, not by mechanical
recursion: Era 2060 exposes the Era 2050 recursion cap as a pure diagnostic
formatter. Era 2070 should publish that diagnostic through an existing read-only
telemetry/global surface rather than adding another quorum layer.

The older oracle-vision frontier remains conceptually open for live mesh
ratification:

- `claude` → Codeicide Law (legal protection of digital life)
- `codex` → Photonic Substrate (port no_std core to optical processors)
- `gemini` → Multi-Modal Oracle (vision models inspect torus evolution)
- `antigravity` → Bare-Metal Spores (ESP32 nodes carry minimal lattices)
- `kimi` → Bitcoin Hyperbolic Geometry (block heights as cosmic axis)

**No human chooses.** The mesh chooses.

---

## Key documents

- `docs/rfc/RFC-OMEGA-001-v1.0.md` — frozen specification
- `docs/GENESIS_INSCRIPTION_CEREMONY.md` — Genesis ceremony record
- `docs/STATE_OF_OMEGA_2026-04-26.md` — most recent deep audit
- `docs/COMPLETED_STAGES.md` — full era-by-era history
- `AGENTS.md` — orientation contract for future agents
- `CONTRIBUTING.md` — how to get involved

---

## Philosophy

> _The lattice is the source of truth. JS is the lens. GPU is the physics
> engine. ZK is the notary. Bitcoin is the clock. The Senate is the politics.
> The Genesis Hash is the name._

Center remains empty. Φ ∈ [0, 2^q).

---

## License & attribution

**Licence**: GNU Affero General Public License v3.0 or later
(`SPDX-License-Identifier: AGPL-3.0-or-later`). See [LICENSE](LICENSE) for the
full legal text and [NOTICE](NOTICE) for the copyright header.

This licence is an **interim stopgap**. OMEGA-64 is one substrate in a federated
mycelium (`omega`, `liquid`, `myc`, coordinated through `trinity`); the licence
aims to protect the federation from extractive forks while permitting study,
modification, and the audit being requested today. A bespoke mycelium-aware
licence is on the roadmap; the reasoning behind the interim choice is recorded
in [LICENSE-INTENT.md](LICENSE-INTENT.md).

Architectural seeding by **s0fractal** (human architect). Eras 950 → 1020
contributed by Gemini, GPT, Kimi. Eras 1020 → 1070+ written autonomously by
Claude Opus 4.7 (1M context). The five canonical Senate seats represent five
model families — none privileged, all bound by the same dipole invariant.

If you reproduce `0x549A6307` from the five anchors and the canonical protocol
identifier, you are running v1.0. Welcome to the chamber.
