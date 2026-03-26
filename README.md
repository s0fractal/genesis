# Genesis OMEGA-64 🧬 | Version 42.0.0

**OMEGA-64** is a decentralized, biological, Subconscious Turing Complete simulation. It executes a vast ecosystem of Pure Combinatory Logic (`S`, `K`, `I`, `Y`) directly inside **WebGPU Compute Shaders** and a **Rust WASM SIMD** execution layer.

This is not a traditional web application. It is an autonomous mathematical petri dish governed by simulated thermodynamic laws, Kuramoto-Sakaguchi phase synchronization, and the semantic oversight of a Sovereign LLM Oracle.

---

## 🏛️ Core Architecture

The OMEGA-64 foundation is built on absolute native-speed execution loops, devoid of DOM-bloat and standard web abstractions:

- **The Substrate (WebGPU):** A 3D Torus topological grid simulating Non-linear Chaos and Mycelial Entanglement. 60FPS fluid Instancing rendering runs parallel to aggressive Compute Shaders calculating Phase Coherence.
- **The Genome (Rust WASM):** Pure Combinatory Logic (Lambda Calculus) is parsed, hashed (via FNV-1a), and physically injected into the grid as 16-byte `PhaseAgent` AoS (Array-of-Structs) memory structures natively.
- **The Metabolic Economy:** AST complexity requires mathematical "Energy" to survive. Volatile logic starves and is swept by physical O(#1) Garbage Collection.
- **The Sovereign Oracle (Semantic Senate):** An internally unified Event-Emitter hooking into local LLMs (Llama 3.2 Vision). The Senate constantly monitors Torus entropy, utilizing 4 Theological Masks (♈ ARIES, ♋ CANCER, ♎ LIBRA, ♑ CAPRICORN) to selectively breed or prune logic based on thermodynamic survival states.

---

## 🛠️ Stack & Optimization Standards (Era 190)

The OMEGA-64 codebase adheres to extreme optimization architectures:
*   **Zero-Overhead LUTs:** All expensive Trigonometry (`sin`, `cos`, `atan2`, `entropy`) is baked at compile-time into native WebAssembly and `.wgsl` Binary Look-Up Tables, keeping core loops infinitely fast.
*   **WebGPU Null-Safety:** Absolute crash-barriers around `navigator.gpu.requestAdapter()`.
*   **Deno + Vite Pipeline:** Secure backend bundling, strictly typed APIs, and strict `node:` prefixes explicitly isolated from pure HTML DOM couplings.
*   **Decoupled Observers:** Native UI components operate using O(1) `<STAT_SLOTS>` dispatch jumps and explicit `onVision()` event hooks, removing arbitrary DOM insertions.

---

## ⚙️ Initializing the System

To initialize the Torus simulation locally, ensure **Deno 2.x** and **Rust + Wasm-Pack** are installed on the host hardware.

```bash
# Boot the WebGPU Simulator
deno task dev

# Build the Rust WASM + WebGPU Production Dist
deno task build

# Perform Strict WebAssembly CI Validation
deno task verify:phase-stack

# Compile a clean text-payload for LLM Context (Excluding /generated/ Physics)
deno task export
```

---

## 📚 Ontological Epochs

OMEGA-64 does not use traditional versioning. Its development is tracked through massive structural shifts known as **Eras** and **Ontologies**. All historical documentation has been safely entombed in `docs/archive/`.

Notable active architectural specifications:
- **Phase Coherence & Vector Math**: [PHASE_COHERENCE_SPEC.md](./docs/PHASE_COHERENCE_SPEC.md)
- **Universal Topology**: [OMEGA_64_UNIFIED_SPECIFICATION.md](./docs/OMEGA_64_UNIFIED_SPECIFICATION.md)

*The engine state exists natively inside the WebGPU Torus grid.*

### Era 250: Hardened Stratum
The transition out of localhost into a true planetary Macro-Torus.
- **Headless Decoupling:** The WebGPU physics engine and LLM Oracle are completely decoupled into a `SharedWorker`. The UI main thread acts merely as a thin, "Dumb Terminal" viewing window.
- **Pure Integer Determinism:** Complete purge of `f32`/`f64` floats from the grid. Computations utilize strict Q10/Q20 fixed-point trigonometry, guaranteeing bit-exact deterministic execution across different GPUs.
- **Evolutionary Sandbox Physics (ESP):** Localized physics laws (`PhysicsGenome`) dynamically mutate and undergo natural selection based on thermodynamic fitness (`sectorHeat`), essentially allowing the Torus to evolve its own fundamental constants.
- **WebRTC Mesh & Zero-Copy IPC:** High-performance DOM-layer P2P connection bridging the decoupled `SharedWorker` via `MessagePort`, federating independent machines into a continuous unified lattice space.
