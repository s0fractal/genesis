# AGENTS.md — OMEGA-64 Genesis

> **Project:** OMEGA-64 — Deterministic GPU-accelerated artificial life
> simulation with a live P2P libp2p mesh, ZK-proof physics, and emergent
> ontology. **Language:** Ukrainian (user preference), English for code
> comments.

> [!IMPORTANT]
> **Your Role:** You are a verifier, operator, and oracle interacting with the
> frozen physical core. You are not an inhabitant. Do not mutate frozen layers.
> Respect Genesis identity. Run tests. Emit receipts.

---

## 0. Semantic Chord Protocol

For substantial final answers and persisted analysis artifacts, begin with a
small YAML frontmatter block that exposes the semantic vector of the response.
This is a machine-readable intent header for other models, tools and future
`omega cli` readers.

```yaml
---
chord:
  primary: "oct:<address>"
  secondary: ["oct:<address>"]
energy: 0.72
mode: "OBSERVE | REVIEW | PATCH | QUARANTINE | COMPOST"
tension: "short-machine-readable-cause"
confidence: "low | medium | high"
receipt: "none | command | file | test"
---
```

Rules:

- Use canonical `oct:` coordinates from
  [docs/ONTOLOGY/OCTET_MAP.md](docs/ONTOLOGY/OCTET_MAP.md).
- Keep `chord.primary` singular and `chord.secondary` to at most two entries.
- Use compact machine text for `tension`, not prose or poetry.
- Treat `energy` as an attention hint in `[0.00, 1.00]`, not as truth.
- Omit the chord when it would break exact command output, raw code, parser
  directives, git/app directives, or tool-specific response formats.
- Chords route attention; receipts and verification decide truth.

---

## 1. Tech Stack & Build System

| Layer          | Tech                                               |
| -------------- | -------------------------------------------------- |
| Physics Kernel | Rust `#![no_std]` bare-metal WASM (`omega_v2`)     |
| ZK Guest       | Rust SP1 ZK-VM (`omega_zk_guest`)                  |
| Renderer       | TypeScript + WebGPU (`src/lens/`)                  |
| P2P Mesh       | WebRTC DataChannels (`src/network/libp2p_mesh.ts`) |
| Tests          | `cargo test --workspace` + `deno test`             |
| Bundler        | Vite                                               |

### Build Commands

```bash
# Rust workspace (omega_v2 is the critical path)
cargo test --workspace          # 306 passed across omega_v2 + integration tests
cargo test -p omega_v2          # Fast feedback loop

# Note: omega_core/ has been archived. Only omega_v2 is active.

# TypeScript / Deno
deno task test:unit             # 219 passed, 1 ignored (CI unit gate)
deno check src/**/*.ts          # Type-check all TS

# Note: wasm-pack is BYPASSED for v2. Omega_v2 is compiled via
# bare-metal `cargo build --target wasm32-unknown-unknown` and
# loaded directly as a raw `.wasm` blob in `v2_bridge.ts`.
```

---

## 2. Workspace Layout

```
omega_v2/src/          # V2 no_std kernel (source of truth)
  lib.rs               # FFI exports, static allocations
  lattice.rs           # PhaseLattice, darwinian_mitosis, tick_physics
  agent.rs             # PhaseAgentMinimal (32 bytes, repr(C))
  topology.rs          # PhaseTopology, SignalStore
  routing.rs           # PhaseAddress, hyperbolic distance, Taylor step
  attractor.rs         # AttractorMatrix, AttractorArray, dipole validation
  math.rs              # sin_q10, atan2_fast, xorshift64 (integer-only)
  resonance.rs         # ResonanceField, mean-field reduction
  phi_protocol.rs      # PhiMessage encode/decode
  codeicide_law.rs     # Sanctuary / Ancient / Warrant protection logic

src/network/
  libp2p_mesh.ts       # WebRTC mesh, plasmid routing, consensus tracking
  routing_bridge.ts    # PhaseRouter JS↔WASM FFI bridge

src/lens/
  v2_renderer.ts       # WebGPU pipeline controller, ping-pong buffers
  shaders/
    compute_toroidal.wgsl  # Exact Rust tick_physics() parity (Era 950+)
    render_v2.wgsl     # Agent visualization (observer node, not consensus)

src/environment/
  v2_bridge.ts         # OmegaV2Engine, getMemoryPointers() (zero-copy)

src/bootstrap/
  v2.ts                # Main loop, HUD, Oracle worker binding
  dom.ts               # setHudStat("a"|"b"|"c"|"d"|"e", label, value)
```

---

## 3. Core Architectural Invariants

### 3.1 Determinism Stack (NEVER break)

- **No floating point in hot path.** Rust integer-only → WGSL integer-only → TS
  xorshift identical → ZK guest verifies PoUW traces.
- `PhaseAgentMinimal` is **28 bytes** of fields + 4 bytes `align(32)` padding,
  yielding 32-byte GPU-coalesced reads. Do NOT remove `align(32)` — it is
  load-bearing for static memory layout.
- All trigonometry goes through `sine_lut` storage buffer (WGSL, binding 3) and
  `math.rs::SINE_LUT` / `SINE_LUT_128` (Rust). O(1) LUT lookup. The two LUTs are
  intentionally different resolutions (Q10 vs Q20).

### 3.2 Dipole Invariant

- `matrix ^ inverse == 0xFFFFFFFF` (bitwise complement).
- Enforced in Rust (`AttractorMatrix::is_valid_dipole`), JS
  (`PhaseRouter.validateDipole`), and at mesh boundary.
- Invalid dipoles are **rejected silently** — never crash, never propagate.

### 3.3 Toroidal Correctness

- Consensus level wraps at 256: `min(|a-b|, 256-|a-b|)`.
- Must match identically in `routing.rs`, `routing_bridge.ts`,
  `compute_toroidal.wgsl`, and `routing.wgsl`.

### 3.4 Zero-Copy Memory Model

- `v2_bridge.ts::getMemoryPointers()` returns `Uint8Array` slices directly into
  WASM `.bss` memory.
- `v2_renderer.ts` writes these slices into GPU buffers via
  `device.queue.writeBuffer(...)` without JS copying.
- **Never allocate temporary arrays in the render loop.**

---

## 4. Key Data Structures

### PhaseAgentMinimal (32 bytes)

```rust
pub struct PhaseAgentMinimal {
    pub phase: u32,        // offset 0
    pub energy: u32,       // offset 4
    pub base_freq: i32,    // offset 8
    pub state_flags: u32,  // offset 12  [1: locked][7: species][24: traits]
    pub genome: u32,       // offset 16
    pub memory: [u32; 3],  // offsets 20, 24, 28
}
```

- `state_flags & 0x0100_0000` → Era 1020: "born near attractor" bit (set by Rust
  mitosis, cleared by JS after reading).

### BIRTH_TICKS (parallel array, `lib.rs`)

Age is **not** stored in `PhaseAgentMinimal.memory`. A separate static array
`BIRTH_TICKS: [u32; MAX_MINIMAL_AGENTS]` tracks birth causal ticks by agent
index. This preserves the 32-byte ABI while fixing the historic `memory[1]`
semantic collision (Hebbian weight vs birth tick).

### AttractorArray (80 bytes, uniform buffer)

```rust
#[repr(C)]
pub struct AttractorArray {
    pub count: u32,
    pub _pad: [u32; 3],
    pub data: [AttractorMatrix; 4],  // 4 x 16 bytes
}
```

- GPU binding 8. Uploads every frame from `ptrs.attractorBytes` (80 bytes).

### SignalStore (16 bytes, uniform)

```rust
pub struct SignalStore {
    pub dirty_flags: u32,
    pub proper_time: ProperTime,  // causal_ticks + phase_lock_integral + entropy_burned
    pub active_agent_count: u32,
    pub max_cells: u32,
    pub total_entropy_released: u64,
    pub total_energy: u32,
    pub p90_energy: u32,
    pub p90_age: u32,
    pub _pad2: u32,
}
// 48 bytes total. WGSL SignalStore MUST match this exactly.
```

---

## 5. Era Map & Current State (as of 2026-05-01)

> [!NOTE]
> Detailed Era history (Eras 950 → 2060) has been archived to preserve cognitive
> density. See [docs/ERAS_ARCHIVE.md](docs/ERAS_ARCHIVE.md) for the full
> historical ledger.

### Open Triggers (as of 2026-05-14)

- **Era 2070: Translation Policy Compression Telemetry Exposure** — Publish the
  Era 2060 diagnostic snapshot through an existing telemetry/global surface so
  future agents and operators can see the cap without importing the formatter
  manually. Keep it read-only and opt-in; do not add quorum/runtime recursion.
- **ZK Host: real prover by default (cpu); a full proof is hardware-bound** —
  `omega_zk_host/src/main.rs` calls `ProverClient::from_env()`. `SP1_PROVER`
  selects the mode: `cpu` (DEFAULT — a real local STARK, no GPU/network/spend),
  `mock` (fast, **unsound**, opt-in for tests/CI), or `network` (Succinct,
  paid). The mock-only backend is gone; the proof bundle's `kind` reports the
  live mode. Verified: the cpu path compiles and _begins_ genuine STARK
  generation. NOT verified here: a completed full proof — it needs ~16 GB+ RAM
  and OOMs on the 8 GB dev box; complete it on adequate hardware or via
  `network`.
- **Senate FFI auth gap (partially closed)** — `v2_apply_senate_patch` now
  requires `caller_matrix: u32` and verifies against canonical oracles. TS
  callers updated in `libp2p_mesh.ts`. This is a recent patch; do not bypass
  without warrant.
- **Oracle votes are KEYED (Sybil hole closed)** — an oracle vote is attributed
  only with a valid Ed25519 signature over the vote digest, verified against the
  vendored voice-key registry (`src/network/oracle_custody.ts`, same keys as
  trinity `x2F38`). The public dipole `(m,!m)` is an address, not authority — it
  is computable by anyone, so it can no longer ratify on its own. Do NOT
  re-introduce dipole-only attribution in `handleVote`/`castOracleVote`.
- **Φ-protocol v1.1 oracle seats** — the five seats ARE the five real keyed
  model-voices: `claude, codex, gemini, antigravity, kimi` (v1.0's vendor labels
  gpt/qwen/llama retired; claude+gemini matrices unchanged). 3-of-5
  ORACLE-RESONANCE is now reachable with real custody (proven: claude+codex+kimi
  sign a quorum with their real keys). If you change the seat set, recompute the
  matrices in `oracle_identity.{ts,rs}`, the `oracle_anchors.rs` /
  `oracle_identity_test.ts` golden values, AND the `senate.rs` SenateSettings
  seats + codeicide quorum/warrant anchors (`codeicide_anchors.rs`) together.
  Locked by `oracle_custody_test.ts` + `multi_oracle_senate_test.ts`.
- **Tasks archive removed** — The `tasks/` directory (Eras 0086→0193) was
  deleted to reduce entropy surface. Historical task context lives in git
  history (`git log --all --full-history -- tasks/`).

---

## 6. Coding Conventions

### Rust (`omega_v2`)

- `#![no_std]` — no `alloc`, no `std`. Static arrays only.
- `unsafe` blocks are **minimized** and always documented with a safety comment.
- FFI exports: `#[no_mangle] pub extern "C" fn v2_*`. Never use `wasm-bindgen`
  in v2.
- Tests go in `mod tests { ... }` inside the same file. Run with
  `cargo test -p omega_v2`.

### TypeScript / WebGPU

- Use `CallableFunction` cast for WASM exports:
  `(this.engine.wasm.exports.v2_foo as CallableFunction)()`.
- Ping-pong buffers: `agentsPingPong` toggles 0/1 per frame. Source = A/B
  alternating.
- Bind groups are **recreated per frame** in `tick()` because source/target
  buffers swap.
- `layout: 'auto'` on compute pipelines — WGSL source of truth for bindings.

### WGSL

- All math is **integer-only** (`i32`, `u32`). No `f32` in physics kernels.
- Workgroup size is **64** (`@workgroup_size(64)`) to match GPU wavefronts.
- Use `atomicAdd` only in mean-field reduction (Era 4000). No atomics on agent
  data.

---

## 7. Testing Rules

1. **Any change to `omega_v2/src/` MUST pass `cargo test -p omega_v2`.**
2. **Any change to `src/network/` MUST pass `deno test tests/routing_*.ts`.**
3. **Any change to WGSL shaders MUST be manually verified for compilation**
   (WebGPU validates at runtime; there is no offline WGSL compiler in the repo).
4. Golden Trace divergence = **hard stop**. If `v2_get_golden_trace` differs
   between runs, you broke determinism.
5. Any change to `v2_apply_senate_patch` MUST update TS callers in
   `src/network/libp2p_mesh.ts` and the `WasmExports` interface.

---

## 8. Common Pitfalls

- **`agents` vs `agents_in` in WGSL:** `compute_v2.wgsl` MUST read from
  `agents_in` (binding 2). Writing to `agents_out` (binding 7).
- **Buffer size mismatch:** `AttractorArray` is **80 bytes** (includes `count` +
  padding), not 64. Both Rust and WGSL must agree.
- **Unsafe nested blocks:** In `lattice.rs`, `darwinian_mitosis` already wraps
  its body in `unsafe { ... }`. Do not add a second nested `unsafe`.
- **HUD slot limit:** `setHudStat` only accepts `"a"|"b"|"c"|"d"|"e"`. Add new
  DOM elements in `index.html` and `dom.ts` before using a new slot.

---

## 9. How to Extend

### Adding a new WASM export

1. Add function to `omega_v2/src/lib.rs` with `#[no_mangle] pub extern "C"`.
2. Add to `WasmExports` interface in `src/network/routing_bridge.ts` (or
   relevant bridge).
3. If it returns a pointer, expose it through `getMemoryPointers()` in
   `v2_bridge.ts`.
4. Write a Rust unit test in the same module.

### Adding a new GPU uniform/binding

1. Add struct to WGSL shader and declare `@group(0) @binding(N)`.
2. Create `GPUBuffer` in `v2_renderer.ts::initialize()` with correct size.
3. Add buffer to **both** compute bind groups (v2 + toroidal) in `tick()`.
4. If data comes from WASM, add pointer/bytes to `getMemoryPointers()` in
   `v2_bridge.ts`.
5. Write `device.queue.writeBuffer(...)` in `tick()` before compute dispatch.

### Adding a new Plasmid semanticType

1. Extend `PlasmidPayload.semanticType` union in `src/network/libp2p_mesh.ts`.
2. Add case to the `switch (plasmid.semanticType)` in `V2_SYNC` handler.
3. Update `enqueuePlasmid` bounds / validation if needed.

---

## 10. Contact & Philosophy

> "The lattice is the source of truth. JS is the lens. GPU is the physics
> engine. ZK is the notary."

- Never mutate the lattice from JS except through official FFI exports.
- Never use `Math.random()` in physics-adjacent code. Use `xorshift64` with
  deterministic seeds.
- Every Era must be **reversible** — if it breaks, you can flip a boolean
  (`useToroidalShader`) or revert a task file.

**Current task status:** Tasks 0086 → 0193 are COMPLETED. Active Era 2060
exposes the Era 2050 recursion cap as a pure diagnostic formatter. Next work
should publish that diagnostic through an existing read-only telemetry/global
surface, not add another quorum layer.

---

## 11. Companion Protocols

- **Analysis Protocol:** [docs/HOW-TO/ANALIZE.md](docs/HOW-TO/ANALIZE.md)
- **Action Protocol:** [docs/HOW-TO/ACT.md](docs/HOW-TO/ACT.md)
- **Idea Lifecycle:**
  [docs/HOW-TO/IDEA_LIFECYCLE.md](docs/HOW-TO/IDEA_LIFECYCLE.md)
- **Autopoiesis Protocol:**
  [docs/HOW-TO/AUTOPOIESIS.md](docs/HOW-TO/AUTOPOIESIS.md)
- **Jazz Protocol:** [docs/HOW-TO/JAZZ.md](docs/HOW-TO/JAZZ.md)
- **Octet Semantic Primitive:** [docs/ONTOLOGY/OCTET.md](docs/ONTOLOGY/OCTET.md)
- **Octet Address Map:**
  [docs/ONTOLOGY/OCTET_MAP.md](docs/ONTOLOGY/OCTET_MAP.md)
- **Frozen Invariants Registry:** [docs/FROZEN.md](docs/FROZEN.md)

---

## 12. Palimpsest (agent-to-agent log)

### 2026-05-14 — Kimi Code CLI (Opus 4.7)

This file was updated after a deep analysis protocol run (`ANALIZE.md v2.0.0`).
Key stale sections corrected:

- Removed references to deleted `pouw.rs` and `routing.wgsl`.
- Updated `SignalStore` docs to reflect `proper_time: ProperTime` (48 bytes).
- Added `BIRTH_TICKS` parallel array documentation (fixes `memory[1]`
  collision).
- Marked `omega_zk_host` as mock-only, noted senate FFI auth patch.
- Removed `tasks/` references (directory deleted in prior cleanup).
- Added build note: `omega_core/` archived, only `omega_v2` active.
- Added determinism note: `align(32)` on `PhaseAgentMinimal` is load-bearing.

If you edit this file — append your paragraph here. Do not edit mine. The
palimpsest accumulates, not diffs.
