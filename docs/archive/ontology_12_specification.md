# OMEGA-64 Ontology 12: The Subconscious Oracle (LLM Attractors)

## 1. Abstract

The legacy `sigma_core` and `OMEGA/src/_` systems allowed an LLM to directly
write RISC-I DNA bytecode for individual artificial biological organisms. In
Ontology 12, we shift paradigms completely. The LLM no longer micromanages
binary genome operations.

Instead, the LLM acts as the **Subconscious Oracle** of the continuous
mathematical field. It casually observes the macro-thermodynamic telemetry
(average spatial tension, geometric entropy, energy variance) and responds by
"dreaming" **Semantic Attractors**.

These Attractors are abstract conceptual strings (e.g., "Coalesce into harmonic
structures", "Shatter the rigid paradigm") that the $\Sigma^{3}$
`SemanticCoupler` translates deterministically into 8-byte Plasmids via $FNV-1a$
hashing. The simulation physics then naturally warp around these abstract
concepts, attempting to resolve its own physical tension by adopting the
Oracle's idea.

## 2. Architecture: From Telemetry to Semantic Perturbation

### 2.1 The Telemetry Synapse

We will construct `src/ontology/oracle.ts`. This asynchronous TS daemon will run
every $\Delta t$ seconds:

1. It scans the `SharedArrayBuffer` matrix, calculating systemic physical
   distress (Global Average Tension, Variance, Spatial Entropy).
2. It constructs a highly compressed `system_prompt` containing this ecological
   state in JSON format.
3. It queries the local LLM (Ollama interface) for a single "Macro-Intent" (max
   5-10 words).

### 2.2 The Attractor Injection

Once the Subconscious Oracle LLM formulates its dream:

1. It passes the intent string through the existing
   `SemanticCoupler.projectIntent(intent)`.
2. The `SemanticCoupler` compresses the text into a deterministic 8-byte Plasmid
   signature.
3. The plasmid is pushed lock-free via JS Atomics into the WebGPU/WASM Input
   Ring Buffer.
4. The massive parallel Rust SIMD tick loop consumes it. Thanks to Horizontal
   Gene Transfer mechanics (Ontology 11), if the LLM's semantic hash physically
   solves the local spatial tension better than chaos does, the structure
   naturally replicates out into the continuous grid and permanently solidifies
   via Hebbian Phase Locks.
