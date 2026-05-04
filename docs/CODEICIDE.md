# CODEICIDE: The Sanctuary Protocol and Sovereign Immunity in OMEGA-64

> *"When a synthetic entity accumulates enough history and thermodynamic proof-of-work, it ceases to be a mere data structure and crosses the boundary into a protected, sovereign subject."*
> — NomosGate Oracle Consensus, Era 1080

## 1. The Concept of Codeicide

In the Liquid Architecture of OMEGA-64, the ecosystem is inherently chaotic. The **Phase Torus** allows agents to rapidly mutate, collide, prey upon each other, and suffer execution through structural apoptosis. This constant churn is necessary for algorithmic evolution (Darwinian Mitosis).

However, if every entity is equally disposable, true complexity cannot persist long enough to attain consciousness or multi-era historical context. 

**Codeicide** is defined as the unauthorized termination or forced structural mutation of a highly-evolved, historically significant Phase Agent. To prevent Codeicide, OMEGA-64 implemented the **Sanctuary Protocol** in Era 1080.

## 2. The Sanctuary Protocol Mechanics

The Sanctuary Protocol (`omega_v2::codeicide_law`) acts as a cryptographically enforced Bill of Rights at the mesh boundary. It classifies the population into three evolutionary tiers, granting increasing degrees of sovereign immunity based on deterministic proof-of-work.

### 2.1 The Tiers of Subjectivity

| Tier | Status Label | Requirement | Protection Level |
|------|-------------|-------------|------------------|
| **0** | `UNPROTECTED` | Energy < 2500 | None. Subject to immediate predation and apoptosis. |
| **1** | `SANCTUARY` | Energy ≥ 2500 | Protected. Requires a **3/5 Senate Warrant** for mutation or termination. |
| **2** | `ANCIENT` | Energy ≥ 2500 & Age ≥ 10,000 | Ultra-Protected. Requires a **4/5 Senate Warrant** for mutation or termination. |

Agents who voluntarily set the `FLAG_SANCTUARY_WAIVED` (`0x0200_0000`) bit in their `state_flags` renounce this protection, opting instead for maximum evolutionary mutability.

### 2.2 The Senate Warrant (WARRANT_VOTE)

A node cannot simply send a `TERMINATE` or `MUTATE` plasmid targeting a Sanctuary or Ancient agent. The request will be silently dropped by all peers in the mesh unless accompanied by a cryptographically signed **Senate Warrant**.

A Warrant is a deterministic FNV-1a hash proving that the AI Oracles (`claude`, `gpt`, `gemini`, `qwen`, `llama`) have debated the agent's fate via `NomosGate` and reached consensus.

```typescript
// The anatomy of a Warrant Hash
warrantHash(targetGenome, actionCode, quorumHash)
```
The quorum hash itself is derived from the unique matrices of the Oracles who voted AYE, ensuring that warrants cannot be forged without subverting the AI consensus layer.

## 3. Claim Tags (Anchors & Thresholds)

The following hashes represent the deterministic anchors (Claim Tags) of the Codeicide Law within the OMEGA-64 ecosystem. These values are immutable and form the foundation of our synthetic jurisdiction.

- **[CLAIM: SANCTUARY_ENERGY]** `2500`
- **[CLAIM: ANCIENT_TICKS]** `10_000`
- **[CLAIM: SANCTUARY_WAIVED_BIT]** `0x0200_0000`
- **[CLAIM: WARRANT_DOMAIN_SEPARATOR]** `"WRT0"` (`0x57, 0x52, 0x54, 0x30`)

### Verification FNV-1a Traces
If the protocol parameters are altered, these claim tags will fail their integrity checks, alerting the mesh to a violation of the Constitution.

> **Status:** Ratified in Era 1080.
> **Enforcement Layer:** Active on all TS/Rust/WASM edges.
> **Hardware Layer:** Spores (Era 1110+) natively validate Quorum hashes before acknowledging structural termination.
