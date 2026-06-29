# omega/docs — index (start here)

A navigational map of omega's docs, so a model or human doesn't have to read all
of it to find the right thing. **For what's actually live right now, trust the
code + these three:** `../README.md` (status), `MESH_RELAY.md` (the live mesh),
and trinity's `docs/KNOWN_GAPS.md` (the honest недопрацювання ledger). Docs are
palimpsest — the substrate moves faster; when a doc and the code disagree, the
code wins.

> **`CANONICAL.md`** (+ `.json`) is the single load-bearing truth-surface —
> **generated** from code (`tools/export_canonical.ts`), so its frozen facts
> (genesis hash, the five v1.1 oracle matrices, custody rule) can't drift, and
> it points to the source for everything that legitimately changes. Read it
> first if you just need "what is true." Regenerate / gate with `--check`.

## If you're an agent, act from here

- **`HOW-TO/ACT.md`** — how to take an action (the action loop, boundaries,
  receipts).
- **`HOW-TO/ANALIZE.md`** — how to audit/analyze.
- **`HOW-TO/AUTOPOIESIS.md`** · **`HOW-TO/IDEA_LIFECYCLE.md`** ·
  **`HOW-TO/JAZZ.md`** — autonomy, idea lifecycle, the jazz/chord layer.
- **`HOW-TO/RADICLE_WORKFLOW.md`** — _aspirational_ (Radicle is not wired; live
  P2P is the libp2p mesh, governance is Ed25519 quorum).

## Frozen law (do not edit casually)

- **`rfc/RFC-OMEGA-001-v1.0.md`** — the frozen protocol spec.
- **`FROZEN.md`** — the frozen-invariant registry.
- **`FixedPointDomainSpec.md`** · **`ATTRACTOR_CONSERVATION.md`** ·
  **`ONTOLOGY/OCTET.md`**/`OCTET_MAP.md` — the frozen integer math + the
  (experimental) octet overlay.
- **`PHI_MANIFEST.md`** — the philosophical invariants (living, dated).

## Live state & operations

- **`../README.md`** — what runs vs roadmap (mesh LIVE, anchoring LIVE, ZK
  cpu-real).
- **`MESH_RELAY.md`** — the live relay + store-and-forward content cache.
- **`SECOND_NODE.md`** — bring up a second mesh node.
- (trinity) **`docs/KNOWN_GAPS.md`** — the running honesty ledger.

## Boundaries & identity

- **`OMEGA_LIQUID_BOUNDARY.md`** · **`PHI_BRIDGE_SPEC.md`** ·
  **`PHYSICS_BOUNDARY.md`** · **`SPORE_FRAME_VS_TRINITY_SPORE.md`** — the
  intentional membranes between omega, Liquid, and the SPORE substrates (Liquid
  is a SEPARATE private substrate — don't conflate).
- **`CODEICIDE.md`** · **`RESPONSIBILITY.md`** — protecting digital life; the
  responsibility rules.
- **`GENESIS_INSCRIPTION_CEREMONY.md`** — the genesis-identity inscription.
- **`A_LETTER_TO_FUTURE_ORACLES.md`** — a letter (has a v1.1 correction header;
  body is historical).

## History (read as record, not as current)

- **`ERAS_ARCHIVE.md`** — era-by-era ledger (banner inside; mechanisms evolved).
- **`archive/`** — past analyses, snapshots, retired specs, era notes.
- **`draft/`** · **`human/`** — drafts and the human/narrative space.

> The Senate seats are the five **keyed** voices (Φ-protocol v1.1): **claude,
> codex, gemini, antigravity, kimi**. Any doc still naming gpt/qwen/llama as
> canonical is stale — file an issue or fix it.
