# Genesis Phase Coherence

`Genesis` should stop treating `x/y` as the primary ontology of the field. The
simulation already evolves mostly through phase, omega, LUT lookup, and
resonance. The next coherent step is to make Cartesian coordinates a render
projection, not the substrate itself.

## Core Doctrine

- The substrate is a phase lattice, not a square pixel grid.
- Spatial identity is angular and radial first, Cartesian second.
- Memory is organized around ring topology, phase progression, and harmonic
  coupling.
- `x/y` remains useful for visualization and interoperability, but it is a
  derived view of the field rather than the canonical state.

## Proposed Memory Model

Each logical cell is addressed by:

- `sector`: angular slot on a ring
- `rho`: radial shell / band index
- `harmonic`: harmonic layer / basis channel

Each logical cell evolves through:

- `theta`: local phase angle on the LUT domain `0..255`
- `omega`: angular velocity / phase drift per tick
- `amplitude`: bounded energy / excitation magnitude
- `lock`: local coherence lock / coupling persistence
- `entanglement`: bounded long-range coupling strength to the antipodal sector

This yields a practical canonical tuple:

`(sector, rho, harmonic) -> { theta, omega, amplitude, lock, entanglement }`

The render projection becomes:

`x = rho * cos(sector)`

`y = rho * sin(sector)`

The semantic interpretation becomes:

- `sector`: where on the ring the cell lives
- `rho`: how far from the core shell it lives
- `harmonic`: which resonance band it belongs to
- `theta`: what phase it currently expresses
- `omega`: how fast it rotates through phase space
- `amplitude`: how strongly it is present in the field
- `lock`: whether it is cohering or decohering with neighbors
- `entanglement`: how strongly it may couple to a far antipodal partner

## Why This Fits Genesis

Today, the hottest logic in `omega_core/src/simd_tick.rs` already depends on
`theta_*`, `omega`, LUT lookup, and phase-lock behavior much more than on
Cartesian movement. That means `Genesis` is already phase-first in practice, but
not yet phase-first in architecture.

This phase lattice model keeps the strongest part of `Genesis`:

- good register-level thinking
- direct memory orientation
- compact Rust/WASM execution
- clean visual coupling to the browser

without inheriting all of `OMEGA`'s ontological surface area.

## Main Verify Target

`Genesis` should have its own principal gate:

`verify:phase-coherence`

This is not a copy of `OMEGA`'s `verify:coherence`. It is the admission test for
the phase lattice itself.

The stronger admission stack is now:

- `verify:phase-coherence`
- `verify:phase-parity`
- `verify:phase-bridge`
- `verify:phase-bridge:parity`
- `verify:phase-cross`
- `verify:phase-goldens`

Where:

- `verify:phase-coherence` proves the invariants
- `verify:phase-parity` proves exact TS reference <-> Rust/WASM state parity on
  the canonical lattice
- `verify:phase-bridge` proves the compatibility bridge remains deterministic
  and rotationally equivariant
- `verify:phase-bridge:parity` proves exact TS reference <-> Rust/WASM state
  parity on the compatibility bridge
- `verify:phase-cross` proves the current `phase -> hybrid` collapse-diff stays
  inside the committed cross-mode trace envelope
- `verify:phase-goldens` proves the exported canonical traces did not drift

## Required Invariants

## Kuramoto And Distance

This should not be treated as literal quantum entanglement.

The correct model is:

- local oscillators still obey a Kuramoto-like synchronization law
- long-range effects are additional graph edges over the oscillator lattice
- "distance action" is sparse, bounded, and phase-mediated

So the safe rule is:

- Kuramoto remains the base transport law for `omega`
- coherence / amplitude stay driven by phase alignment
- long-range coupling is only a bounded correction term

That keeps the system in generalized Kuramoto territory rather than replacing it
with magic.

### 1. Deterministic Replay

For a fixed seed, LUT, and mutation set:

- repeated runs produce identical field signatures
- no hidden time sources or host nondeterminism may change the result

### 2. Global Phase Rotation Equivariance

If every cell's `theta` is rotated by a constant offset:

- the next state must be exactly the same rotation of the unrotated result

This is the strongest sign that the kernel respects circular phase geometry.

### 3. Angular Address Rotation Equivariance

If every cell is moved by a constant `sector` offset:

- the next state must be exactly the same address rotation of the unrotated
  result

This proves the lattice does not privilege any absolute angular slot.

### 4. Wraparound Safety

The following must hold:

- `theta + 256 == theta`
- `sector + sector_count == sector`
- neighbor lookup across boundaries is continuous

No seam is allowed at the LUT edge or ring edge.

### 5. Bounded Drift

After any accepted update:

- `theta` remains in `0..255`
- `omega` remains inside a bounded domain
- `amplitude` remains in `0..255`
- `lock` remains in `0..255`

No mutation is admitted if it violates boundedness.

### 6. Projection Stability

Projection from `(sector, rho)` to `(x, y)` must remain finite and continuous:

- no NaN / Infinity
- radius remains monotonic with `rho`
- render is a view, not a second physics model

## Mutation Admission Rule

A mutation or kernel change is only admitted if:

1. `verify:phase-coherence` passes
2. `verify:phase-parity` passes
3. `verify:phase-bridge` passes
4. `verify:phase-bridge:parity` passes
5. `verify:phase-cross` passes
6. the replay signature stays deterministic
7. rotational equivariance is preserved
8. bounded drift remains intact
9. `verify:phase-goldens` still matches the committed canonical traces

This should become the `Genesis` equivalent of a coherence gate.

## Stage Plan

### Stage 0

- define the lattice math and invariants in TypeScript
- create a small deterministic verification harness
- prove the invariants outside the Rust kernel first

### Stage 1

- migrate neighbor lookup from Cartesian adjacency to phase-lattice adjacency
- move from `idx +/- width` to `(sector, rho, harmonic)` neighborhood logic
- `omega_core/src/simd_tick.rs` now also contains `execute_phase_bridge_tick` as
  a compatibility bridge over the old `Field` layout
- `verify:phase-bridge` validates the compatibility bridge independently of the
  pure phase-lattice kernel

### Stage 2

- replace canonical `x/y` substrate state with derived Cartesian projection
- keep Cartesian coordinates only for rendering, IO, and debug views

### Stage 3

- port the verified lattice rules into `omega_core`
- add kernel-level replay signatures and admission checks

### Stage 4

- align the TypeScript reference and Rust/WASM kernel on one canonical seed
- use one structural signature algorithm across both runtimes
- fail on the first divergent cell/tick via `verify:phase-parity`
- publish canonical replay traces through `tools/goldens/*.json`

### Stage 5

- bind `phase` and `hybrid` into one replay/diff surface
- formalize `phase -> hybrid` collapse/crop comparison as `verify:phase-cross`
- treat cross-mode drift as an admission gate, not only as a visual viewer

### Stage 6

- give `hybrid` its own TypeScript reference kernel
- fail on the first divergent bridge cell/tick via `verify:phase-bridge:parity`
- keep bridge goldens for both reference and wasm traces

## Immediate Next Step

Stage 0 is now represented by:

- `src/shared/phase_lattice.ts`
- `tools/verify_phase_coherence.ts`
- `tools/verify_phase_parity.ts`
- `tools/verify_phase_bridge_parity.ts`
- `tools/verify_phase_cross.ts`
- `tools/verify_phase_goldens.ts`

That gives `Genesis` a concrete first doctrine:

not "cells on a grid that happen to carry phase", but "a phase lattice that may
be rendered as a grid when useful".
