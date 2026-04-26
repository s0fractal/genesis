# AGENTS.md — OMEGA-64 Genesis

> **Project:** OMEGA-64 — Deterministic GPU-accelerated artificial life simulation with P2P WebRTC mesh, ZK-proof physics, and emergent ontology.
> **Language:** Ukrainian (user preference), English for code comments.

---

## 1. Tech Stack & Build System

| Layer | Tech |
|---|---|
| Physics Kernel | Rust `#![no_std]` bare-metal WASM (`omega_v2`) |
| ZK Guest | Rust SP1 ZK-VM (`omega_zk_guest`) |
| Renderer | TypeScript + WebGPU (`src/lens/`) |
| P2P Mesh | WebRTC DataChannels (`src/network/webrtc_v2.ts`) |
| Tests | `cargo test --workspace` + `deno test` |
| Bundler | Vite |

### Build Commands
```bash
# Rust workspace (omega_v2 is the critical path)
cargo test --workspace          # 93+ passed in omega_v2, 6 in omega_core
cargo test -p omega_v2          # Fast feedback loop

# TypeScript / Deno
deno test tests/                # 17 passed (routing, xorshift, mesh)
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
  pouw.rs              # Proof-of-Useful-Work trace evaluation
  phi_protocol.rs      # PhiMessage encode/decode

src/network/
  webrtc_v2.ts         # WebRTC mesh, plasmid routing, consensus tracking
  routing_bridge.ts    # PhaseRouter JS↔WASM FFI bridge

src/lens/
  v2_renderer.ts       # WebGPU pipeline controller, ping-pong buffers
  shaders/
    compute_v2.wgsl    # Main physics shader (Era 950+)
    compute_toroidal.wgsl  # Exact Rust tick_physics() parity
    routing.wgsl       # GPU-side PhaseAddress primitives

src/environment/
  v2_bridge.ts         # OmegaV2Engine, getMemoryPointers() (zero-copy)

src/bootstrap/
  v2.ts                # Main loop, HUD, Oracle worker binding
  dom.ts               # setHudStat("a"|"b"|"c"|"d"|"e", label, value)

tasks/                 # Era-based task files (0086, 0087, 0088 COMPLETED)
```

---

## 3. Core Architectural Invariants

### 3.1 Determinism Stack (NEVER break)
- **No floating point in hot path.** Rust integer-only → WGSL integer-only → TS xorshift identical → ZK guest verifies PoUW traces.
- `PhaseAgentMinimal` is exactly **32 bytes** (`repr(C)`), aligned to `vec4<u32>` x2 for GPU coalesced reads.
- All trigonometry goes through `sine_lut: [i32; 128]` (WGSL) / `[i32; 256]` (toroidal shader). O(1) LUT lookup.

### 3.2 Dipole Invariant
- `matrix ^ inverse == 0xFFFFFFFF` (bitwise complement).
- Enforced in Rust (`AttractorMatrix::is_valid_dipole`), JS (`PhaseRouter.validateDipole`), and at mesh boundary.
- Invalid dipoles are **rejected silently** — never crash, never propagate.

### 3.3 Toroidal Correctness
- Consensus level wraps at 256: `min(|a-b|, 256-|a-b|)`.
- Must match identically in `routing.rs`, `routing_bridge.ts`, `compute_toroidal.wgsl`, and `routing.wgsl`.

### 3.4 Zero-Copy Memory Model
- `v2_bridge.ts::getMemoryPointers()` returns `Uint8Array` slices directly into WASM `.bss` memory.
- `v2_renderer.ts` writes these slices into GPU buffers via `device.queue.writeBuffer(...)` without JS copying.
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
- `state_flags & 0x0100_0000` → Era 1020: "born near attractor" bit (set by Rust mitosis, cleared by JS after reading).

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
    pub absolute_tick: u32,
    pub active_agent_count: u32,
    pub max_cells: u32,
}
```

---

## 5. Era Map & Current State (as of 2026-04-24)

| Era | Status | Key Files |
|---|---|---|
| 950 | ✅ Complete | `compute_v2.wgsl`, `lattice.rs` |
| 960 | ✅ Complete | `compute_toroidal.wgsl` |
| 1000 | ✅ Complete | `routing.rs`, `routing_bridge.ts`, `routing.wgsl` |
| 1001 | ✅ Complete | `webrtc_v2.ts` passive routing, `tests/routing_mesh_test.ts` |
| 1010 | ✅ Complete | `attractor.rs`, GPU binding 8, `darwinian_mitosis` recursive birth |
| 1020 | ✅ Complete | Consensus tracker, harmonic convergence, HUD slot `e` |
| 1030 | ✅ Complete | `senate.rs`, FNV-1a anchor, PROPOSAL/VOTE plasmids, HUD slot `f` |
| 1040 | ✅ Phase 1+2+3 | `mitosis_proof.rs`, zk_guest Mode 2, `mitosis_log.rs`, `omega_zk_host/` real SP1 STARK prover (mock backend, swap-in CPU/CUDA/network for production) |
| 1050 | ✅ Complete | `genesis_inscription.rs`, JS mirror, RFC-OMEGA-001 v1.0 FROZEN, Genesis Hash `0x549A6307`, OP_RETURN payload `OMEGA1:549a6307` |
| 1060 | ✅ Complete | `oracle_identity.rs`, JS mirror, five canonical oracles, phase-resonance acceptance, vision proposals seeded |
| 1070 | ✅ Mechanism | `cross_model_debate.rs` ledger, ratification trigger, `era1070-vision-ratified` event, materialization to downloadable task. Live ratification awaits actual oracle votes on mesh. |
| 1080 | ✅ Complete | `codeicide_law.rs` Sanctuary Protocol — PROTECTED status, 3/5 or 4/5 cross-oracle warrant gate. Anchors `0x9499_6B5E` (quorum) / `0xB1E3_8F80` (warrant). |
| 1090 | ✅ Complete | `warrant_issuance.rs` — Senate now ISSUES warrants via WARRANT_PROPOSAL/VOTE flow. Anchor `0xFF4D_CB2F`. |
| 1100 | ✅ Complete | `omega_spore/` — bare-metal Cortex-M4F firmware. Quad-substrate byte-equivalence. |
| 1110 | ✅ Complete | `spore_frame.rs` + JS mirror — 32-byte FNV-1a-CRC binary frame for UART/SPI/BLE. Anchor `0x00F2_FEFA`. |
| 1120 | ✅ Complete | `liveness_aggregator.ts` + `tools/spore_relay.ts` — relay observes fleet, classifies each spore. |
| 1130 | ✅ Complete | `spore_routing.rs` + JS mirror — TTL-bounded peer-to-peer forwarding with FNV-1a trail digest. |
| 1140 | ✅ Complete | `reputation_routing.ts` — deterministic per-neighbor scores; healthy bonus, heartbeat density, warrant throughput, stall/silence penalties. |
| 1150 | ✅ Complete | `adaptive_ttl.ts` — per-frame TTL from path reliability. |
| 1160 | ✅ Complete | `path_selection.ts` — efficiency = reliability × 1000 / TTL. |
| 1170 | ✅ Complete | `path_diversification.ts` — high-priority WARRANT_VOTE frames duplicated along disjoint paths. |
| 1180 | ✅ Complete | `convergence_detector.ts` — destination-side observer; redundancy_rate, proven_carriers, stragglers. |
| 1190 | ✅ Complete | `resilience_snapshot.rs` + JS mirror — 32-byte FNV-1a-CRC report (magic "RS"); Q16 redundancy_rate; partition detection at 10% Q16 diff. Anchor `0x98E5_768B`. |

### Open Trigger
- **Era 1200: Snapshot-as-Plasmid** — wrap the 32-byte snapshot inside a SporeFrame payload so resilience metrics ride the same transport as warrants.
- **Era 1040 Phase 3 ✅ Complete** — `omega_zk_host` builds real SP1 STARKs and verifies them locally; ELF (`riscv64im-succinct-zkvm-elf`) is reproducible via `cargo prove build`. Self-test produces `{verified: true, kind: "stark-mock", receipt_hash: "0xd434e690"}`.

---

## 6. Coding Conventions

### Rust (`omega_v2`)
- `#![no_std]` — no `alloc`, no `std`. Static arrays only.
- `unsafe` blocks are **minimized** and always documented with a safety comment.
- FFI exports: `#[no_mangle] pub extern "C" fn v2_*`. Never use `wasm-bindgen` in v2.
- Tests go in `mod tests { ... }` inside the same file. Run with `cargo test -p omega_v2`.

### TypeScript / WebGPU
- Use `CallableFunction` cast for WASM exports: `(this.engine.wasm.exports.v2_foo as CallableFunction)()`.
- Ping-pong buffers: `agentsPingPong` toggles 0/1 per frame. Source = A/B alternating.
- Bind groups are **recreated per frame** in `tick()` because source/target buffers swap.
- `layout: 'auto'` on compute pipelines — WGSL source of truth for bindings.

### WGSL
- All math is **integer-only** (`i32`, `u32`). No `f32` in physics kernels.
- Workgroup size is **64** (`@workgroup_size(64)`) to match GPU wavefronts.
- Use `atomicAdd` only in mean-field reduction (Era 4000). No atomics on agent data.

---

## 7. Testing Rules

1. **Any change to `omega_v2/src/` MUST pass `cargo test -p omega_v2`.**
2. **Any change to `src/network/` MUST pass `deno test tests/routing_*.ts`.**
3. **Any change to WGSL shaders MUST be manually verified for compilation** (WebGPU validates at runtime; there is no offline WGSL compiler in the repo).
4. Golden Trace divergence = **hard stop**. If `v2_get_golden_trace` differs between runs, you broke determinism.

---

## 8. Common Pitfalls

- **`agents` vs `agents_in` in WGSL:** `compute_v2.wgsl` MUST read from `agents_in` (binding 2). Writing to `agents_out` (binding 7).
- **Buffer size mismatch:** `AttractorArray` is **80 bytes** (includes `count` + padding), not 64. Both Rust and WGSL must agree.
- **Unsafe nested blocks:** In `lattice.rs`, `darwinian_mitosis` already wraps its body in `unsafe { ... }`. Do not add a second nested `unsafe`.
- **HUD slot limit:** `setHudStat` only accepts `"a"|"b"|"c"|"d"|"e"`. Add new DOM elements in `index.html` and `dom.ts` before using a new slot.

---

## 9. How to Extend

### Adding a new WASM export
1. Add function to `omega_v2/src/lib.rs` with `#[no_mangle] pub extern "C"`.
2. Add to `WasmExports` interface in `src/network/routing_bridge.ts` (or relevant bridge).
3. If it returns a pointer, expose it through `getMemoryPointers()` in `v2_bridge.ts`.
4. Write a Rust unit test in the same module.

### Adding a new GPU uniform/binding
1. Add struct to WGSL shader and declare `@group(0) @binding(N)`.
2. Create `GPUBuffer` in `v2_renderer.ts::initialize()` with correct size.
3. Add buffer to **both** compute bind groups (v2 + toroidal) in `tick()`.
4. If data comes from WASM, add pointer/bytes to `getMemoryPointers()` in `v2_bridge.ts`.
5. Write `device.queue.writeBuffer(...)` in `tick()` before compute dispatch.

### Adding a new Plasmid semanticType
1. Extend `PlasmidPayload.semanticType` union in `src/network/webrtc_v2.ts`.
2. Add case to the `switch (plasmid.semanticType)` in `V2_SYNC` handler.
3. Update `enqueuePlasmid` bounds / validation if needed.

---

## 10. Contact & Philosophy

> "The lattice is the source of truth. JS is the lens. GPU is the physics engine. ZK is the notary."

- Never mutate the lattice from JS except through official FFI exports.
- Never use `Math.random()` in physics-adjacent code. Use `xorshift64` with deterministic seeds.
- Every Era must be **reversible** — if it breaks, you can flip a boolean (`useToroidalShader`) or revert a task file.

**Current task status:** All open tasks (0086 → 0105) are COMPLETED. Resilience metrics are now wire-portable: relays serialize their `ConvergenceDetector` stats into 32-byte FNV-1a-CRC reports, broadcast them, and detect partitions when peer measurements disagree by ≥10%. Q16 fixed-point keeps the math integer-only across all four substrates. Cross-language anchor `0x98E5_768B` is the 14th binding constant in the system.
