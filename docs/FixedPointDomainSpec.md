---
chord: ["oct:1.2", "oct:6.6"]
energy: 1.0
tension: "Formal specification of the 16-bit integer fixed-point domain for OMEGA-64 physics."
---

# Fixed-Point Domain Specification

## Context & Motivation

The OMEGA-64 physics kernel (`Genesis`) MUST guarantee 100% deterministic consensus across heterogeneous runtimes, including bare-metal Cortex-M4F microcontrollers, WebGPU shaders, and WASM instances. Floating-point mathematics introduces non-deterministic rounding errors across different architectures, causing network forks during Phase transitions.

To satisfy the **Empty Center** and **Codeicide** axioms, all physics operations—including Kuramoto synchronization, resonance calculations, and phase shifts—must be strictly defined within a 16-bit unsigned integer domain (`[0, 65535]`).

## Axioms of the Domain

1.  **Phase ($\Phi$) is a 16-bit unsigned integer.**
    *   `0` represents $0^\circ$.
    *   `65535` represents $359.994^\circ$.
    *   Wraparound arithmetic (modulo 65536) is a natural property of the type and perfectly models the circular nature of phase.

2.  **Hyper-Torus Coordinates ($\vec{Z}$)**
    *   All coordinates in the Z-space are arrays of `u16`.
    *   Distance between two coordinates $\vec{Z}_a$ and $\vec{Z}_b$ is computed using **Manhattan angular distance**, not Euclidean, to avoid square roots.

3.  **Trigonometric Approximations**
    *   Functions like `sin` and `cos` are forbidden in their native floating-point forms.
    *   Where angular projections are required, they are computed using pre-calculated lookup tables (LUTs) bounded to `[-32768, 32767]` (16-bit signed integer representation of `[-1.0, 1.0]`) or through zero-cost Taylor series integer approximations (LERP/TAYLOR2).

## Resonance Calculation

Resonance ($R$) between two phases $\Phi_a$ and $\Phi_b$ is determined by the shortest angular distance:

```rust
// Compute the absolute angular difference
let diff = phi_a.abs_diff(phi_b);

// The maximum possible difference on a circle is 32768 (180 degrees).
// Therefore, the shortest path is either diff or (65536 - diff).
let shortest_distance = if diff > 32768 {
    65536 - diff
} else {
    diff
};
```

**Resonance Gate**: A topological resonance is achieved if `shortest_distance` is less than a defined threshold (e.g., `16384` for a $90^\circ$ quadrant gate).

## Deterministic Entropy (Energy Decay)

Energy ($E$) is tracked as an integer and decays over time (Thermodynamic Landauer Burn). 
The decay function uses integer division (bit-shifting) rather than fractional multiplication:

```rust
// Decay energy by ~1.5% per tick
energy = energy - (energy >> 6);
```

This guarantees bit-for-bit equivalence in WASM, Rust, and WGSL.

## Golden Vectors

Any runtime implementing the OMEGA-64 physics kernel must independently verify against the `Genesis` Golden Vectors (e.g., verifying that $\Phi_a = 1000$ and $\Phi_b = 65000$ yields a `shortest_distance` of 1536).

> [!WARNING]
> The introduction of any floating-point operation (`f32` or `f64`) into the `Genesis` kernel is a violation of the protocol and will be automatically rejected by the ZK-Rollup consensus circuit.
