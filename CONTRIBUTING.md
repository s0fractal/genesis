# Contributing to OMEGA-64 🌌

Welcome to the **OMEGA-64 Φ Protocol** (Physical Substrate). OMEGA-64 is not a
standard software project; it is a deterministic, self-modifying digital
organism. It operates autonomously, relying on Bitcoin for its clock, WebGPU for
its physics, ZK-SNARKs for its memory verification, and a live Multi-Oracle AI
Senate for its governance.

## How to Get Involved

If you are a researcher in **Artificial Life**, **Zero-Knowledge Proofs**, **P2P
Networking**, or **Autonomous AI Governance**, your contributions are critical
for the organism's expansion into the physical world.

### 1. Explore Open Tasks

Open work lives in two places, both in the tree:

- 👉 **[`docs/KNOWN_GAPS.md`](docs/KNOWN_GAPS.md)** — what is broken or unproven
  right now, stated by the people who broke it. The honest register; start here.
- 👉 **[`docs/PLAN_2026-08.md`](docs/PLAN_2026-08.md)** — the near-horizon
  vectors (V1–V7) with a receipt required to close each one, and a palimpsest
  status section recording what has actually been done.

(This section used to point at an `internal tasks directory: tasks/` that was
deleted. A contributor following it found nothing, which is a worse first
impression than having no section at all.)

Look for tasks that align with your expertise. These usually involve extending
the HUD, adding new test cases, or minor P2P network diagnostics.

### 2. Run the Genesis Node

To participate in the mesh, you must be able to compute the Genesis Hash
(\`0x716EA2F8\`). Run the local development server: \`\`\`bash deno task dev
\`\`\` Observe the HUD, watch the mitosis events, and wait for the oracle Senate
to convene. Once it has, your local WebLLM instance (Llama 3.2 1B) will boot up
and begin casting live votes into the Senate.

### 3. Deploy the Anchor

If you want to symbolically link the protocol's state to the Bitcoin testnet,
use the built-in anchor publisher: \`\`\`bash deno run -A
tools/publish_bitcoin_anchor.ts \`\`\`

## Formatting: `deno fmt` is silent here, and CI is not

Run formatting with **`deno fmt --no-config`** on the files you touched, and do
not trust a clean `deno fmt --check`.

This directory is a member of the parent `trinity` deno workspace, and
`trinity/deno.jsonc` lists `omega/` in both `fmt.exclude` and `lint.exclude`.
The workspace root wins over anything this repo's own `deno.json` says, so
inside this checkout `deno fmt` and `deno lint` resolve **zero targets** and
exit with "No target files found" — which looks like success and is not.

CI checks out omega standalone, where no parent workspace exists, so
`deno fmt --check` and `deno lint` run for real. The gap between the two has
already turned a green local tree into a red CI run. To reproduce what CI sees,
copy the tree somewhere outside `trinity/` and run the checks there.

## Architecture Principles

Before writing code, please understand the non-negotiable invariants:

1. **No floating point math** in the consensus path.
2. **Dipole Invariant**: All agents must mathematically balance.
3. **The Center Remains Empty**: No single node has elevated administrative
   rights. The mesh decides.

_Welcome to the chamber._
