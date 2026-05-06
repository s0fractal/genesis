# Magic Numbers & Simulation Provenance

OMEGA-64 blends rigorous mathematical simulation (Kuramoto phase oscillators, L1 geometric metrics) with an artistic "cosmogony" layer. This document serves to decouple the technical invariants from the curatorial/artistic magic numbers. 

As noted in architectural audits, many constants are not derived from empirical physical bounds, but rather from a desire to tune the simulation toward subjective aesthetic outcomes (e.g. "poetic computational life").

## Curatorial Thresholds

| Constant | Location | Provenance | Purpose |
|----------|----------|------------|---------|
| `SANCTUARY_ENERGY_THRESHOLD = 2500` | `codeicide_law.rs` | Curatorial / Arbitrary | Defines the line at which an agent is deemed to possess enough computational inertia to be legally "protected" from casual overwriting. There is no physical necessity for 2500; it was selected to create scarcity. |
| `ANCIENT_AGE_TICKS = 10_000` | `codeicide_law.rs` | Curatorial / Mythological | The threshold for an agent to be classified as "Ancient." Equivalent to one "millennium" in simulation time. |
| `MAX_ATP = 4000` | `pouw.rs` | Curatorial / Balancing | Caps the maximum metabolic energy a single agent can hoard to prevent unbounded monopolization of the energy economy. |
| `RESONANCE_ATP_BONUS = 150` | `pouw.rs` | Curatorial / Incentivization | Artificial reward mechanism to drive the swarm toward phase-alignment. The Kuramoto model naturally syncs, but the ATP bonus is an artistic choice to "feed" coherence. |
| `METABOLIC_BURN_DIVISOR = 100` | `pouw.rs` | Curatorial / Pacing | Slows down the decay of agent energy to match a human-observable rhythm in the 60fps renderer. |

## Numerological Artifacts

Some constants reflect explicit numerology baked into the "Mythos" of OMEGA-64:

- **`q_phase = 7` ("The Sacred Seven")**: Defined in `lib.rs`, creating 128 phase sectors. While mathematically functional for fixed-point mapping, the choice of 7 is driven by the lore.
- **Senate Arithmetic (`ayes+100`)**: Defined in `senate.rs`, the hard-reject threshold `nays >= 2*(ayes+100)` is an arbitrary parliamentary mechanic chosen to stabilize the "immune system" of the network, rather than an information-theoretic bound.

## Technical Engine Bounds

In contrast to the artistic thresholds above, the core engine relies on hard boundaries derived from memory constraints and integer logic:
- `MAX_MINIMAL_AGENTS = 500_000`: Ensures the entire WASM `.bss` footprint remains below a 16MB threshold to avoid out-of-memory crashes on default browser profiles.
- `FNV-1a 32-bit`: Used extensively for mesh routing and fast checks. **Note:** This is *not* a cryptographically secure hash. References to "cryptographic" validation via FNV-1a refer to casual protocol integrity, not Byzantine fault tolerance against deliberate preimage attacks. 
