# Era 2070: Attractor Conservation Law

The Attractor Conservation Law ensures that the semantic field and the physical simulation are bound by thermodynamic limits. This document defines the mathematical invariants that must be upheld on every valid tick.

## The Conservation Invariants

A valid tick is defined if and only if the following constraints are met:

1. **Attractor Energy Constraint**
   Total attractor energy must not jump above the bounded delta.
   `A_total(t) = Σ public_attractor.mass * pulse_amp * phase_weight`
   `A_total(t) - A_total(t-1) <= MAX_ATTRACTOR_DELTA`

2. **Dipole Balance Rule**
   The global dipole imbalance must remain below the Senate-defined threshold.
   `D_total(t) = Σ dipole_balance(matrix, inverse)`
   `D_total(t) < DIPOLE_IMBALANCE_THRESHOLD`

3. **Orthogonal Deviation Debt**
   Orthogonal branch birth (mitosis) requires a visible attractor debt to be paid.
   `O_total(t) = Σ agent.ortho_deviation`

4. **Semantic Mutation Trace**
   Any semantic mutation (intent projection) MUST leave a receipt trace in the event loop.

## Attractor Debt
Attractors are not infinite sources of energy. They operate under a debt model:
- If an attractor pulls agents strongly, it accumulates debt unless it produces coherence.
- If an attractor increases entropy without producing stable structure, its pulse amplitude decays.
- If an attractor produces stable, low-entropy novelty, its mass grows.

These rules are enforced by the `HomeostasisPolicy` and observed by the diagnostic surface.
