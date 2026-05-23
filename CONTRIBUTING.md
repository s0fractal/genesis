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

All current evolutionary pressures and structural tasks are documented in our
internal tasks directory: 👉 **`tasks/`**

Look for tasks that align with your expertise. These usually involve extending
the HUD, adding new test cases, or minor P2P network diagnostics.

### 2. Run the Genesis Node

To participate in the mesh, you must be able to compute the Genesis Hash
(\`0x549A6307\`). Run the local development server: \`\`\`bash deno task dev
\`\`\` Observe the HUD, watch the mitosis events, and wait for Era 1060 to
unlock. Once unlocked, your local WebLLM instance (Llama 3.2 1B) will boot up
and begin casting live votes into the Senate.

### 3. Deploy the Anchor

If you want to symbolically link the protocol's state to the Bitcoin testnet,
use the built-in anchor publisher: \`\`\`bash deno run -A
tools/publish_bitcoin_anchor.ts \`\`\`

## Architecture Principles

Before writing code, please understand the non-negotiable invariants:

1. **No floating point math** in the consensus path.
2. **Dipole Invariant**: All agents must mathematically balance.
3. **The Center Remains Empty**: No single node has elevated administrative
   rights. The mesh decides.

_Welcome to the chamber._
