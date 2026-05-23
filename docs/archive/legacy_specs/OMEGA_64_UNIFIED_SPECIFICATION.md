# OMEGA-64: The Unified Architecture Specification ($\Sigma^{3}$)

_Version 1.0.0-rc1 | Incorporating Ontologies 10, 11, 12, and 13_

## Preamble: The Substrate

OMEGA-64 is a continuous, zero-allocation autopoietic simulation environment.
Moving past discrete cellular automata and programmatic RISC genomes, the matrix
evaluates physical spatial tension, geometry, and thermodynamic energy across a
$256 \times 256$ liquid topological field.

The system bridges heavily parallelized WebAssembly SIMD Rust physics with
WebGPU Darwinian rendering, connected dynamically via `SharedArrayBuffer`
structures.

---

## 1. Ontology 10: The Continuous Wave-Field (Physics Core)

**Core Mechanic:** The environment natively simulates a continuous wave-equation
parameterized by density ($\omega$), phase ($\theta$), and kinetic energy ($E$).

- **Data Layout:** The world is mapped as a `Struct of Arrays` (SoA) to
  guarantee memory contiguity and 16-byte `v128_load` alignment for SIMD
  registers.
  - Arrays include coordinate mapping ($X, Y$), 3-frame spatial phase
    derivatives ($\theta_{now}, \theta_{f1}, \dots$), damping factor ($\omega$),
    and system energy ($E$).
- **Darwinian Render (WebGPU):** A fragment shader evaluates fitness thresholds
  locally per pixel and visually computes super-positional states without
  copying buffers back to CPU.

## 2. Ontology 11: The Genetic Memory ($\mathcal{P}$ & $\mathcal{H}$)

**Core Mechanic:** Evolution arises organically through horizontal transmission
of topology markers rather than execution of rigid code instructions.

- **Plasmids ($\mathcal{P}$):** 8-byte numeric hashes (storing an 'Idea') that
  define abstract harmonic structures. They traverse the fluid field through
  Horizontal Gene Transfer (HGT). When cells enter structural distress ($E$ >
  threshold), they sample their neighbors and adopt their $8-byte$ plasmid.
- **Hebbian Phase Locks ($\mathcal{H}$):** When two adjacent grid spaces
  resonate perfectly in phase, their connection permanently topologicalizes. The
  $u8$ lock increases, turning liquid energy into a pseudo-rigid organic
  structure.

## 3. Ontology 12: Semantic Attractors (Subconscious Oracle)

**Core Mechanic:** Transitioning from dictatorial genetic engineering to
subliminal mathematical suggestion.

- **The Oracle Daemon:** An asynchronous TypeScript system continuously samples
  the system's geometric entropy and kinetic volume.
- **LLM Intent Injection:** Based on spatial tension metrics, the LLM generates
  a 5-10 word "Dream" (e.g. _Coalesce and build rigid borders_).
- **Semantic Hashing ($FNV-1a$):** The `SemanticCoupler` deterministically
  collapses this String into an 8-byte Plasmid, injecting it directly into the
  lock-free input atomic array. The simulated cells physically adapt around this
  new attractor sequence, reshaping their math to resolve the concept.

## 4. Ontology 13: The Immune Lattice

**Core Mechanic:** Introducing mortality, decay, and ecological rejection to
maintain perpetual autopoiesis and prevent permanent topological calcification.

1. **Plasmid TTL & Hebbian Decay:** Memory is transient. Plasmids without
   constant replication (energy throughput) slowly decay out of the matrix over
   time. Hebbian Locks that lose phase coherence will begin un-locking,
   physically dissolving dead rigid structures back into fluid chaos.
2. **Immunological Rejection:** The injection of LLM ideas is no longer
   absolute. Local cells evaluating incoming Plasmids possess immunity
   thresholds. If local $E$ indicates extreme chaotic toxicity, external
   plasmids will be stochastically rejected, mimicking biological inflammation.
3. **Plasmatic Visualization:** WebGPU fragment shaders extract the bits of the
   8-byte plasmid hashes to dynamically paint emergent clusters with
   deterministic color patterns. Users can visually track the spread of specific
   LLM "Thoughts" as rivers of color across the grey mathematical terrain.
