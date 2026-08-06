# Where omega sits — the federation

You may have arrived at this repository on its own. omega is **not** standalone:
it is one substrate of a four-part federated mycelium. This file is the map
back.

## The four substrates

| substrate   | role                                                          |
| ----------- | ------------------------------------------------------------- |
| **omega**   | physics — a deterministic, integer-exact life kernel (here)   |
| **liquid**  | latent intent — a phase-routed autopoietic substrate          |
| **myc**     | publication & audit — proposal lifecycle, witnesses, finality |
| **trinity** | coordination — the signed chord ledger and the court          |

**Repositories** (the repo names differ from the substrate names):

- trinity — https://github.com/s0fractal/trinity
- omega — https://github.com/s0fractal/genesis
- liquid — https://github.com/s0fractal/liquid_architecture
- myc — https://github.com/s0fractal/myc

Each has its own authority; the value is in their composition under shared
invariants, not in any one alone. `trinity` is the meta-layer that binds them:
the Ed25519 voice registry, the hex-coordinate organ topology, and the external
verification court.

## What is shared

- **One voice registry.** A signature made by a voice verifies identically in
  every substrate (omega reads the same `x2F38_voice_pubkeys.json` that trinity
  publishes). Amending that registry now requires a real 3-of-5 keyed-voice
  quorum (`trinity`'s `t registry-amend`), enforced against out-of-band edits.
- **One licence stance.** All four repos are AGPL-3.0-or-later.
- **One law.** The substrates agree on a single canonical law hash
  (`0xa43f38a1`); disagreement is a detectable fault, not a silent drift.

## Verify the federation without trusting it

The federation's core promise is _"verify us without trusting us."_ From
`trinity`, a stranger runs one command — no clone, read-only network, nothing of
ours but public bytes — and re-derives the four substrates' agreement from raw
bodies. A registered voice cannot make you accept a lie, because the verdict is
recomputed, not merely signed. The verifier lives at
`trinity/probes/external-trust-verifier-v0/court.ts`.

## Pointers

- Coordinated by **trinity** — the chord ledger, `GOVERNANCE.md`, and the
  coordinate decoder (`docs/COORDINATES.md`) live there.
- omega's own entry points: `README.md` (start with "what runs vs in progress"),
  `AGENTS.md`, `llms.txt`.

The code is forkable under AGPL. What a fork cannot silently take is the
federation's legitimacy: key continuity, the quorum-gated registry, the signed
provenance ledger, and live relay continuity.
