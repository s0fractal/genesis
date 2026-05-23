# 🧬 OMEGA-64 Genesis — Консолідований математичний аудит

**Репо:** s0fractal/Genesis (Rust/WASM/TS/WebGPU, ~15 000 LOC коду + WGSL)\
**Метод:** Повний аудит формул, magic numbers, fixed-point math, LCG, crypto
boundaries.\
**Вердикт:** 🟡 Архітектурно потужна система з кількома математичними
невідповідностями та «замазаними» константами. Безпека пам'яті покращена після
рефакторингу V2, але фізичний рівень містить 15+ magic thresholds, що блокують
детерміновану верифікацію.

---

## 1. Що це насправді (без евфемізмів)

**OMEGA-64** — це детерміністичний клітинний автомат на основі фазових
осциляторів Курамото, виконуваний у тришаровому стеку:

- **GPU Layer (WebGPU/WGSL):** Compute shaders оновлюють 1024×1024 тороїдальну
  решітку через fixed-point Q10/Q20 математику.
- **WASM Layer (Rust):** Парсер комбінаторної логіки (S/K/I/Y), фазова
  топологія, delta-snapshot мережа, epigenetic memory.
- **DOM Layer (TypeScript):** Bootstrap, WebRTC P2P mesh, EVM bridge
  (ethers.js), LLM Oracle (WebLLM), HUD telemetry.

**Критична властивість:** система заявляє про **100% побітову детермінованість**
(Golden Trace Validation). Це означає, що будь-яка magic number, яка не
виводиться з `seed` або `block_hash`, — це баг або недокументований джерело
недетермінізму.

---

## 2. Топологія математичних шарів

```text
┌─────────────────────────────────────────────────────────────┐
│  TS Frontend (bootstrap/v2.ts)                              │
│  ├─ frameCount % 60 → 1Hz telemetry (assumes 60 FPS)       │
│  ├─ BigInt hash prefix → cosmic entropy injection           │
│  └─ HUD stats via SharedArrayBuffer atomics                 │
├─────────────────────────────────────────────────────────────┤
│  Rust WASM (omega_core + omega_v2)                          │
│  ├─ omega_core: LambdaArena, PhaseLatticeField (Q20)        │
│  ├─ omega_v2: no_std bare-metal, LCG, epigenetics           │
│  └─ omega_zk_guest: SP1 RISC-V ZK-VM PoUW verifier          │
├─────────────────────────────────────────────────────────────┤
│  WGSL Compute (src/lens/shaders/)                           │
│  ├─ compute_kuramoto.wgsl: Q10 fixed-point Kuramoto        │
│  ├─ compute_v2.wgsl: Era 950+ bare-metal physics            │
│  └─ SINE_LUT_128: precomputed Q7 sin table (omega_v2/math)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Повний каталог формул

### 3.1 Phase & Kuramoto Core (omega_core)

```text
┌──────┬──────────────────────────────────────────────────────────────┬─────────────────────────┬───────┬──────────────────────────────┐
│  #   │                           Формула                            │          Файл           │ Grade │           Зауваження         │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ sin_q10(from, to): idx = (to + 256 - from) % 256;          │                         │       │ % 256 замість & 255.         │
│ F-01 │ Повільна операція modulo на гарячому шляху.                 │ constants.rs:92         │ E3    │ У Q10-контексті має бути      │
│      │                                                              │                         │       │ bitmask & 0xFF.               │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ KURAMOTO_SAKAGUCHI_ALPHA = 77                                │                         │       │ 77/256*2π ≈ 1.89 rad = 108°. │
│ F-02 │                                                              │ constants.rs:17         │ E5    │ Не golden angle (137.5°),    │
│      │                                                              │                         │       │ не π/3, не документовано.     │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ SECTOR_DIVISOR = 73                                          │                         │       │ Prime? 73 — prime. Але чому   │
│ F-03 │                                                              │ constants.rs:20         │ E5    │ саме 73 для 64/128 секторів? │
│      │                                                              │                         │       │ 128/73 ≈ 1.75 — нелогічно.    │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Phase delta: shortest_arc = (a + 128 - b) % 256              │                         │       │ % 256 знову. Для power-of-2  │
│ F-04 │                                                              │ constants.rs:80         │ E3    │ має бути & 255.               │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Q20_SCALE = 1_048_576 (= 2^20). Коректна.                   │                         │       │                               │
│ F-05 │                                                              │ constants.rs:12         │ E2    │ Стандарт fixed-point.         │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ wrap_phase: clamp_i32(value, 0, PHASE_LUT_SIZE) as u8       │                         │       │ PHASE_LUT_SIZE = 256 (i32).   │
│ F-06 │                                                              │ utils.rs:6              │ E2    │ Phase wrap коректний.         │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ FNV-1a 64-bit: hash = ((hash ^ byte) * PRIME)               │                         │       │ Стандартні константи:         │
│ F-07 │ OFFSET_BASIS = 0xcbf29ce484222325, PRIME = 0x100000001b3   │ constants.rs:24-25      │ E2    │ FNV-1a — криптографічно       │
│      │                                                              │                         │       │ слабкий (не collision-res).   │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ LRNG: state = state * 6364136223846793005 + 1               │                         │       │ Knuth/MMIX multiplier.        │
│ F-08 │                                                              │ lambda.rs:19            │ E2    │ Період 2^64. Якісний LCG.     │
└──────┴──────────────────────────────────────────────────────────────┴─────────────────────────┴───────┴──────────────────────────────┘
```

### 3.2 omega_v2 — Bare-Metal Physics

```text
┌──────┬──────────────────────────────────────────────────────────────┬─────────────────────────┬───────┬──────────────────────────────┐
│  #   │                           Формула                            │          Файл           │ Grade │           Зауваження         │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ LCG: seed = seed * 1664525 + 1013904223                     │                         │       │ Numerical Recipes LCG.       │
│ F-09 │                                                              │ lattice.rs:102          │ E2    │ Період 2^32, достатньо для   │
│      │                                                              │                         │       │ 1M агентів (низька якість).  │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Energy: (seed % 900) + 100 → [100, 999]                     │                         │       │ Magic range [100, 999].      │
│ F-10 │                                                              │ lattice.rs:106          │ E5    │ Не виводиться з seed.        │
│      │                                                              │                         │       │ Не power-of-2 aligned.        │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Base freq: ((seed % 4000) - 2000) * 1024                    │                         │       │ seed % 4000 → [0, 3999].     │
│ F-11 │ → base_freq ∈ [-2_048_000, +2_047_744] (Q20)                │ lattice.rs:109          │ E4    │ Чому *1024? Це Q10→Q20       │
│      │                                                              │                         │       │ shift, але не документовано.  │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Genome: seed % 256 → 8-bit genome                           │                         │       │ CRITICAL: PhaseAgentMinimal   │
│ F-12 │                                                              │ lattice.rs:112          │ E4    │ .genome = u32, але тут        │
│      │                                                              │                         │       │ тільки 8 bits ентропії.       │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Mitosis threshold: energy >= 2000                           │                         │       │ Magic. Чому 2000 при          │
│ F-13 │                                                              │ lattice.rs:173          │ E5    │ max energy 4000? Це 50%.      │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Mitosis cost: energy -= 1000                                │                         │       │ Magic 1000 = 25% від cap.     │
│ F-14 │                                                              │ lattice.rs:174          │ E5    │ Не похідна від base_freq.     │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Phase offset child: +128 (opposite harmonic)                │                         │       │ 128 = π при 8-bit phase.      │
│ F-15 │                                                              │ lattice.rs:184          │ E3    │ Логічно, але hardcoded.       │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Mutation mask: genome ^ 0b01010101                          │                         │       │ XOR з фіксованою маскою.      │
│ F-16 │                                                              │ lattice.rs:188          │ E4    │ Завжди інвертує біти 0,2,4,6. │
│      │                                                              │                         │       │ Не стохастично.               │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Golden trace skip: every 1024th agent                       │                         │       │ Magic. При 1M агентів         │
│ F-17 │                                                              │ lattice.rs:208          │ E3    │ sample ~976 точок.            │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Delta threshold: energy_diff > 10 || phase_diff > 40       │                         │       │ Magic thresholds. 10/40       │
│ F-18 │                                                              │ lattice.rs:246          │ E5    │ не виводяться з Q-scale.      │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ SINE_LUT_128[i] = round(sin(2πi/128) * 2^20)               │                         │       │ Q20 precomputed. Коректно.    │
│ F-19 │                                                              │ math.rs:4               │ E2    │ Значення 51451 = sin(π/64)*2^20│
└──────┴──────────────────────────────────────────────────────────────┴─────────────────────────┴───────┴──────────────────────────────┘
```

### 3.3 PoUW ZK Physics (omega_v2/pouw.rs)

```text
┌──────┬──────────────────────────────────────────────────────────────┬─────────────────────────┬───────┬──────────────────────────────┐
│  #   │                           Формула                            │          Файл           │ Grade │           Зауваження         │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Metabolic burn: 1 + (set_bits / 4)                          │                         │       │ /4 = magic. Чому не          │
│ F-20 │                                                              │ pouw.rs:34              │ E4    │ popcount * log(popcount)?    │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Resonance replenish: phase % 64 == 0 → +150 ATP             │                         │       │ 64 = 1/4 періоду при 8-bit.  │
│ F-21 │                                                              │ pouw.rs:40              │ E3    │ 150 — magic, не похідна      │
│      │                                                              │                         │       │ від metabolic burn.           │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Phase drift: (base_freq >> 20) as u32                       │                         │       │ CRITICAL BUG: при негативному│
│ F-22 │                                                              │ pouw.rs:92              │ E6    │ base_freq >> 20 дає -1,      │
│      │                                                              │                         │       │ as u32 → 4294967295 (wrap).   │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Homeostasis: if freq < base → +10, else -10                 │                         │       │ Magic step 10. Не масштабується│
│ F-23 │                                                              │ pouw.rs:97              │ E4    │ з kuramoto_base.              │
└──────┴──────────────────────────────────────────────────────────────┴─────────────────────────┴───────┴──────────────────────────────┘
```

### 3.4 TypeScript / Front-end

```text
┌──────┬──────────────────────────────────────────────────────────────┬─────────────────────────┬───────┬──────────────────────────────┐
│  #   │                           Формула                            │          Файл           │ Grade │           Зауваження         │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Consonance: ratio = max/min; |ratio - target| < 0.05       │                         │       │ Arithmetic tolerance: для    │
│ F-24 │                                                              │ pure_lambda.ts:99       │ E4    │ f=2000Hz, 5% = 100Hz gap.    │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Freq targets: 1.33333 (Perfect 4th)                         │                         │       │ Наближення 4/3. Кумулятивна  │
│ F-25 │                                                              │ pure_lambda.ts:61-64    │ E4    │ похибка при ланцюгових       │
│      │                                                              │                         │       │ операціях.                    │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Cosmic entropy: kuramoto_base = 100 + (val1 % 2900)        │                         │       │ Magic 100 і 2900. Максимум   │
│ F-26 │                                                              │ atp_bridge.ts:161       │ E5    │ = 3000, але Q10 max = 5120.  │
├──────┼──────────────────────────────────────────────────────────────┼─────────────────────────┼───────┼──────────────────────────────┤
│      │ Season: Math.floor(frameCount / 3600) % 4                  │                         │       │ 3600 = 60*60 frames. При     │
│ F-27 │                                                              │ bootstrap/v2.ts:147     │ E4    │ 144 FPS = 25 секунд/сезон.   │
└──────┴──────────────────────────────────────────────────────────────┴─────────────────────────┴───────┴──────────────────────────────┘
```

---

## 4. Повний каталог Magic Numbers

| Файл                          | Рядок | Число      | Контекст                 | Оцінка                        |
| ----------------------------- | ----- | ---------- | ------------------------ | ----------------------------- |
| `omega_v2/src/lattice.rs`     | 102   | 1664525    | LCG multiplier           | Ок (Numerical Recipes)        |
| `omega_v2/src/lattice.rs`     | 102   | 1013904223 | LCG increment            | Ок (Numerical Recipes)        |
| `omega_v2/src/lattice.rs`     | 106   | 900        | energy range denominator | 🔴 Magic                      |
| `omega_v2/src/lattice.rs`     | 106   | 100        | energy base offset       | 🔴 Magic                      |
| `omega_v2/src/lattice.rs`     | 109   | 4000       | freq range denominator   | 🔴 Magic                      |
| `omega_v2/src/lattice.rs`     | 109   | 2000       | freq zero offset         | 🔴 Magic                      |
| `omega_v2/src/lattice.rs`     | 109   | 1024       | freq Q-scale multiplier  | 🟡 Undocumented               |
| `omega_v2/src/lattice.rs`     | 112   | 256        | genome entropy limit     | 🔴 Only 8 bits of 32          |
| `omega_v2/src/lattice.rs`     | 173   | 2000       | mitosis threshold        | 🔴 Hard 50% of cap            |
| `omega_v2/src/lattice.rs`     | 174   | 1000       | mitosis cost             | 🔴 Hard 25% of cap            |
| `omega_v2/src/lattice.rs`     | 184   | 128        | child phase π-offset     | 🟡 Logical but hardcoded      |
| `omega_v2/src/lattice.rs`     | 188   | 0b01010101 | XOR mutation mask        | 🔴 Deterministic, not random  |
| `omega_v2/src/lattice.rs`     | 208   | 1024       | golden trace skip        | 🟡 Should be `max(1, N/1024)` |
| `omega_v2/src/lattice.rs`     | 246   | 10         | delta energy threshold   | 🔴 Not Q-derived              |
| `omega_v2/src/lattice.rs`     | 246   | 40         | delta phase threshold    | 🔴 Not Q-derived              |
| `omega_v2/src/pouw.rs`        | 34    | 4          | metabolic burn divisor   | 🔴 Magic                      |
| `omega_v2/src/pouw.rs`        | 40    | 64         | resonance phase modulus  | 🟡 1/4 period                 |
| `omega_v2/src/pouw.rs`        | 41    | 150        | ATP replenish amount     | 🔴 Magic                      |
| `omega_v2/src/pouw.rs`        | 53    | 17         | stressor LCG mixer       | 🟡 Prime, ok                  |
| `omega_v2/src/pouw.rs`        | 92    | 20         | phase drift Q-shift      | 🟡 Q20→integer                |
| `omega_v2/src/pouw.rs`        | 97    | 10         | homeostasis step         | 🔴 Magic                      |
| `omega_core/src/constants.rs` | 17    | 77         | KURAMOTO_ALPHA           | 🔴 108°, undocumented         |
| `omega_core/src/constants.rs` | 20    | 73         | SECTOR_DIVISOR           | 🔴 Prime, purpose unclear     |
| `src/bootstrap/v2.ts`         | 133   | 60         | telemetry frame interval | 🔴 Assumes 60 FPS             |
| `src/bootstrap/v2.ts`         | 147   | 3600       | frames per season        | 🔴 60 FPS assumption          |
| `src/network/atp_bridge.ts`   | 161   | 100        | cosmic entropy base      | 🔴 Magic                      |
| `src/network/atp_bridge.ts`   | 161   | 2900       | cosmic entropy range     | 🔴 Magic                      |
| `src/network/atp_bridge.ts`   | 164   | 10         | diffusion base           | 🔴 Magic                      |
| `src/network/atp_bridge.ts`   | 164   | 1000       | diffusion range          | 🔴 Magic                      |
| `src/compiler/pure_lambda.ts` | 56    | 54.0       | audio root freq          | 🟡 432/8, ok but magic        |
| `src/compiler/pure_lambda.ts` | 99    | 0.05       | consonance tolerance     | 🔴 Arithmetic, not log        |
| `src/compiler/pure_lambda.ts` | 99    | 10.0       | consonance bonus         | 🔴 Linear reward              |

---

## 5. Critical Issues (математичні баги)

### CRIT-1: Negative `base_freq` drift wrap (F-22) ✅ FIXED

**Файл:** `omega_v2/src/pouw.rs:92`\
**Код:** `let drift = (agent.base_freq >> 20) as u32;`\
**Проблема:** `base_freq` — `i32`. При negative values, arithmetic right shift
`>> 20` на Two's Complement дає `-1` (0xFFFFFFFF). `as u32` перетворює це на
`4294967295`.\
**Наслідок:** Агент з негативною частотою отримує phase drift = 4.29 мільярда,
що миттєво обнуляє або колапсує phase.\
**Виправлення:** Використано arithmetic shift i32: `agent.base_freq >> 20`
зберігає знак, потім wrapping_add як i32:

```rust
let drift = agent.base_freq >> 20;
agent.phase = (agent.phase as i32).wrapping_add(drift) as u32;
agent.phase &= max_phase_mask;
```

### CRIT-2: Genome entropy truncation (F-12) ✅ FIXED

**Файл:** `omega_v2/src/lattice.rs:112`\
**Код:** `let genome = seed % 256;`\
**Проблема:** `PhaseAgentMinimal.genome` — `u32` (32 bits), але ініціалізація
дає тільки 8 bits. Всі мутації (`^ 0b01010101`) також 8-bit.\
**Наслідок:** 24 старші біти genome завжди 0. Епігенетична пам'ять
(EpigeneticMemory) теж оперує 32-бітними частотами, але вхідні дані — 8-bit.\
**Виправлення:** `ignite_big_bang` тепер використовує `seed` без `% 256`.
Мутація в `darwinian_mitosis` використовує повний 32-бітний `mut_seed` з LCG.

### CRIT-3: Golden trace non-determinism при N < 1024 ✅ FIXED

**Файл:** `omega_v2/src/lattice.rs:200-218`\
**Код:** `let skip = 1024; for i in (0..active).step_by(skip)`\
**Проблема:** Якщо `active_agent_count < 1024`, golden trace = 0 (жоден агент не
потрапляє у вибірку).\
**Наслідок:** При тестуванні з малими популяціями (<1024) `get_golden_trace()`
завжди повертає 0.\
**Виправлення:** Адаптивний skip — завжди ~32 семпли:
`let skip = if active == 0 { 1 } else { max(1, active / 32) };`.

### CRIT-4: CPU fallback ABI mismatch (phase_compute.ts) ✅ FIXED

**Файл:** `src/lens/phase_compute.ts:300`\
**Код:** `dv.setUint8(offset + 12, 255); // max amp` — фактично писав у
`theta`.\
**Проблема:** CPU fallback писав `inj.phase` та `inj.amp` у неправильні offset
PhaseAgent.\
**Виправлення:** Коректна мапа ABI: `offset+12 = theta (inj.phase)`,
`offset+13 = energy (inj.amp)`, `offset+15 = entanglement (inj.ent)`.

### CRIT-5: u32 overflow у `max_elements` ✅ FIXED

**Файл:** `omega_core/src/phase_lattice.rs:131`\
**Код:** `(sectors * radial_bins * harmonics * tau_depth) as usize`\
**Проблема:** `sectors`, `radial_bins`, `harmonics` — `u32`. Їх добуток може
переповнити `u32` до приведення до `usize`.\
**Виправлення:** Проміжне приведення до `u64`:
`((sectors as u64) * (radial_bins as u64) * (harmonics as u64) * (tau_depth as u64)) as usize`.

### CRIT-6: `q_phase > 7` underflow у `get_sin` ✅ FIXED

**Файл:** `omega_v2/src/topology.rs:79`\
**Код:** `let shift_up = 7 - self.q_phase;`\
**Проблема:** При `q_phase > 7` — underflow u32. При `q_phase >= 32` — panic у
`phase_mask()` (shift >= width).\
**Виправлення:** `assert!((2..=7).contains(&q_phase))` у `PhaseTopology::new`.
`set_environment` перевіряє `q_sectors < 32 && q_radial < 32`.

### CRIT-7: `atan2_u8` i32 overflow ✅ FIXED

**Файл:** `omega_core/src/constants.rs:139`\
**Код:** `(a * 128) / b`\
**Проблема:** `a` і `b` — `i32`. При великих значеннях (~20M) `a * 128`
переповнює `i32`.\
**Виправлення:** Проміжне `i64`: `((a as i64) * 128 / (b as i64)) as i32`.

### CRIT-8: `wrap_index` не працює для non-power-of-2 ✅ FIXED

**Файл:** `omega_core/src/constants.rs:111`\
**Код:** `value & (modulo - 1)`\
**Проблема:** Працює лише для power-of-2. Для `modulo = 10` дає неправильний
результат.\
**Виправлення:** `value.rem_euclid(modulo)` — коректний модуль для будь-якого
знаку та модулю.

### CRIT-9: `0.92 * 1024 ≠ 96` — константна плутанина ✅ FIXED

**Файл:** `omega_core/src/phase_lattice.rs:562`\
**Код:** `amplitude > 96 // ~37.6% of max u8 energy (255)`\
**Проблема:** `KURAMOTO_ANTIPODE_ALIGNMENT_THRESHOLD = 942` (= 0.92 * 1024) — це
Q10 threshold для `cos_anti`, а `amplitude > 96` — u8 threshold для energy.
Старий коментар плутав ці концепції.\
**Виправлення:** Коментар оновлено на `~37.6% of max u8 energy (255)`. Обидві
константи коректні у своєму контексті.

### CRIT-10: `harmonics = 0` divide-by-zero ✅ FIXED

**Файл:** `omega_core/src/phase_lattice.rs:502`\
**Код:** `(harmonic + 1) % harmonics`\
**Проблема:** Panic при `harmonics = 0`.\
**Виправлення:** Guard `if harmonics > 0 { ... % harmonics } else { past_idx }`.

---

## 6. High Issues (неоптимальність та waste)

### HIGH-1: LCG period exhaustion (F-09) ✅ FIXED

**Файл:** `omega_v2/src/lattice.rs:102`\
LCG з period 2^32. Кореляції між сусідніми викликами високі (поганий Spectral
Test).\
**Виправлення:** Перехід на **xorshift64*** (`omega_v2/src/math.rs`). Period
2^64-1. SplitMix64 seeding. Швидше, кращі spectral properties, zero allocations.
`xorshift32_once` для per-bit epigenetic entropy.

### HIGH-2: Delta snapshot thresholds без Q-derivation (F-18) ✅ FIXED

**Файл:** `omega_v2/src/lattice.rs:372`, `omega_v2/src/topology.rs:114-125`\
`energy_diff > 10 || phase_diff > 40` — ці числа не виводилися з `q_phase` або
Q-scale. При зміні топології thresholds залишалися тими самими.\
**Виправлення:**

- `DELTA_PHASE_DIVISOR = 8` →
  `delta_phase_threshold() = max(1, phase_mask / 8)`. Для q_phase=7 (mask=127):
  threshold=15. Для q_phase=5 (mask=31): threshold=3.
- `DELTA_ENERGY_DIVISOR = 128` →
  `delta_energy_threshold() = max(1, MAX_ATP / 128)`. Для MAX_ATP=4000:
  threshold=31.
- Обидва thresholds тепер адаптивні до топології та енергетичного масштабу.
  Magic numbers 10/40 видалено.

### HIGH-3: Modulo замість bitmask (F-01, F-04) ✅ FIXED

**Файл:** `omega_core/src/constants.rs:93,99`\
`(to_theta + 256 - from_theta) % 256` — `% 256` на гарячому шляху.\
**Виправлення:** `sin_q10` і `cos_q10` тепер використовують `& 0xFF` замість
`% 256`.

### HIGH-4: Космічна ентропія — magic mapping + Math.random (F-26) ✅ FIXED

**Файл:** `src/network/atp_bridge.ts:161`\
`kuramoto_base = 100 + (val1 % 2900)` — діапазон [100, 2999]. Без явних
констант.\
**Виправлення (частина 1):** Винесено magic numbers у named constants
(`KURAMOTO_BASE_MIN`, `KURAMOTO_BASE_RANGE`, `KURAMOTO_DIFF_MIN`,
`KURAMOTO_DIFF_RANGE`, `Q10_MAX_KURAMOTO`, `Q10_MAX_DIFFUSION`,
`EVM_BLOCK_TIME_MS`, `MOCK_NETWORK_DELAY_MS`).

**Файл:** `src/network/atp_bridge.ts:89-91`\
`Math.random()` у `MockATPBridge.subscribeToCosmicEntropy` — non-deterministic,
неперевірюваний, не відповідає Rust kernel RNG.\
**Виправлення (частина 2):** Створено `src/math/xorshift.ts` — порт xorshift64*
з `omega_v2/src/math.rs` на TypeScript (BigInt). `MockATPBridge` тепер
використовує `Xorshift64TS` з seedable deterministic entropy. 7 TS unit tests
verify determinism, bounds, period, hex output.

### HIGH-5: Асинхронна консонанс-функція (F-24) ✅ FIXED

**Файл:** `src/compiler/pure_lambda.ts:99`\
`calculateConsonanceBonus` використовує arithmetic tolerance (`< 0.05`) для
frequency ratio. Високі частоти мали величезний допуск, низькі — мініскопічний.\
**Виправлення:** Замінено на log-tolerance:
`Math.abs(Math.log2(ratio) - Math.log2(target)) < 0.07`.

### HIGH-6: PhaseAgent не 32-byte aligned ✅ FIXED

**Файл:** `omega_core/src/granite.rs:4-5`\
**Код:** Коментар "perfectly 32-byte aligned structure" / "256-bit blocks"\
**Проблема:** `PhaseAgent` займає **24 байти**, а не 32. Коментар вводив в
оману.\
**Виправлення:** Коментар оновлено на реальний розмір (24 bytes, 8-byte
aligned). Додано compile-time `assert!(size_of::<PhaseAgent>() == 24)` для
захисту від майбутніх змін.

### HIGH-7: Агрегатні функції зміщують вибірку до зовнішнього шару ✅ DOCUMENTED + EXTENDED

**Файл:** `omega_core/src/phase_lattice.rs:741, 755, 770`\
**Проблема:** `total_amplitude`, `total_entanglement`, `omega_span` вибирають
**лише зовнішнє радіальне кільце** (`rho = max`).\
**Виправлення:** Додано HIGH-7 коментарі до всіх агрегатних функцій. Додано
`_all_rho` варіанти (`phase_lattice_total_amplitude_all_rho`,
`phase_lattice_total_entanglement_all_rho`) для повноцінного аналізу.

### HIGH-8: Shannon entropy сумує всі tau (не current_tau) ✅ DOCUMENTED

**Файл:** `omega_core/src/phase_lattice.rs:786-795`\
**Проблема:** `phase_lattice_shannon_entropy` ітерує всі агенти всіх `tau` і
гармонік. Назва не відображає, що це total volume entropy.\
**Виправлення:** Додано HIGH-8 коментар, який явно документує масштабування з
`tau_depth` та `harmonics`.

### HIGH-9: phenotype_hue використовує f64 trig (не cross-platform deterministic) ✅ DOCUMENTED

**Файл:** `omega_core/src/lambda.rs:266-304`\
**Код:** `f64::sin`, `f64::cos`, `f64::atan2`\
**Проблема:** Результати `atan2` можуть відрізнятися на останніх бітах між x86
(glibc) і ARM (musl).\
**Виправлення:** Додано HIGH-9 коментар до `phenotype_hue`, який документує
обмеження і рекомендує LUT-based trig (`atan2_u8`) або `libm` soft-float для
ZK-VM.

### HIGH-10: WebGPU Compute Shader Race Condition ✅ FIXED

**Файл:** `src/lens/shaders/compute_v2.wgsl`\
**Проблема:** Compute shader читав і писав в один і той же `agents` буфер
(`storage, read_write`). Паралельні workgroup threads могли оновлювати сусідів,
поки інші threads їх ще читали — data race з невизначеною поведінкою.\
**Виправлення:** Реалізовано ping-pong подвійну буферизацію:

- `agents_in` (binding 2, `read`) — джерело для читання сусідів і поточного
  агента.
- `agents_out` (binding 7, `read_write`) — ціль для запису оновленого state.
- `v2_renderer.ts` створює `agentsBufferA` / `agentsBufferB`, swap кожен кадр.
  Bind groups перестворюються в `tick()` з актуальними буферами.

### HIGH-11: CPU-GPU Physics Tick Duplication ✅ FIXED

**Файл:** `src/lens/v2_renderer.ts`\
**Проблема:** `tick()` викликав `this.engine.tick()` (CPU WASM `tick_physics`) і
потім запускав WebGPU compute pass. Фізика виконувалась двічі на різних даних
(WASM memory vs GPU buffer), створюючи повний розсинхрон state.\
**Виправлення:** Прибрано `this.engine.tick()` з `tick()`. GPU тепер монопольно
володіє physics loop. CPU WASM використовується тільки для:

- `v2_mitosis_sweep()` (через `readStateFromGPUAndHash`)
- `v2_resonance_scan()` та golden trace
- Phi-message buffer (compost/intent/delta)
- `absolute_tick` інкрементується в JS напряму перед `writeBuffer`, щоб GPU
  cold-start fallback (`signals.absolute_tick & max_phase_mask`) просувався.

### HIGH-12: WGSL `deterministic_sin` не синхронізований з Rust `get_sin` ✅ FIXED

**Файл:** `src/lens/shaders/compute_v2.wgsl`\
**Проблема:** `deterministic_sin` використовував `sine_lut[index]` без зсуву
`7 - q_phase`. Для `q_phase < 7` Rust виконує `idx << (7 - q_phase)`, тоді як
WGSL брав прямий індекс — різні значення LUT та некоректна тригонометрія.\
**Виправлення:** Оновлено `deterministic_sin` і `deterministic_cos` у WGSL:

```wgsl
let shift_up = 7u - q_phase;
return sine_lut[index << shift_up];
```

Тепер WGSL LUT lookup ідентичний Rust `PhaseTopology::get_sin/get_cos`.

### HIGH-13: WebRTC Golden Trace порівняння через hex string (NaN) ✅ FIXED

**Файл:** `src/network/webrtc_v2.ts:130-134`\
**Проблема:** `packet.gt` передавався як hex string (наприклад `"AB12"`), а
`localTrace` — number. Порівняння `packet.gt > localTrace` конвертувало hex
string в `NaN`, і `NaN > anything` завжди `false`. Tie-breaker при
розсинхронізації ніколи не спрацьовував.\
**Виправлення:** `latestGoldenTrace` змінено з `string` на `number`.
`setLatestState()` приймає `number`. `broadcastV2State` серіалізує число. При
отриманні `remoteGt = packet.gt as number` — порівняння строго числове.
`v2_renderer.ts` і `bootstrap/v2.ts` оновлені для передачі `goldenTraceNum`.

### HIGH-14: Remote Delta Mutation без bounds check ✅ FIXED

**Файл:** `src/network/webrtc_v2.ts:147-168`\
**Проблема:** При застосуванні delta mutations від віддаленої ноди, `index` з
пакета використовувався напряму для доступу до `gridU32[index * 8]` без
перевірки меж. Зловмисна нода могла передати `index >= maxAgents` і спричинити
out-of-bounds запис у WASM/GPU пам'ять.\
**Виправлення:** Додано `const maxAgents = gridU32.length / 8;` та
`if (index >= maxAgents) continue;` з логуванням попередження. Також
`numMutations` тепер `Math.floor(deltasU32.length / 4)` для запобігання читанню
неповних deltas.

### HIGH-15: `oldMeanFieldBuffer` неініціалізований на першому кадрі ✅ FIXED

**Файл:** `src/lens/v2_renderer.ts`\
**Проблема:** `oldMeanFieldBuffer` створювався через `device.createBuffer()` без
ініціалізації. На першому кадрі `compute_v2.wgsl` читав неініціалізовану пам'ять
для global mean field, що давало невизначений cold-start behavior.\
**Виправлення:** Додано
`device.queue.writeBuffer(this.oldMeanFieldBuffer, 0, new Uint8Array(8))` в
`initialize()` для zero-initialization.

### HIGH-16: `sineLutBuffer` надмірно копіюється кожен кадр ✅ FIXED

**Файл:** `src/lens/v2_renderer.ts`\
**Проблема:**
`this.device.queue.writeBuffer(this.sineLutBuffer, 0, ptrs.sineLutBytes)`
викликався в `tick()` кожен кадр (60×/с), хоча LUT статичний і ніколи не
змінюється.\
**Виправлення:** Перенесено запис LUT в `initialize()` (одноразово). Економія
~30KB/s PCIe трафіку.

### HIGH-17: `deterministic_atan2` brute-force O(128) на GPU-hot-path ✅ FIXED

**Файл:** `src/lens/shaders/compute_v2.wgsl`\
**Проблема:** `deterministic_atan2` виконував brute-force dot-product scan по
всій фазовій сітці (128 ітерацій для q_phase=7). Для 1M агентів це 128M ітерацій
на кадр — найдорожча операція в шейдері.\
**Виправлення:** Замінено на O(1) CORDIC-inspired atan2 з 129-entry LUT
(`atan2_fast`), скопійований з `generated_constants.wgsl` (V1 kernel). Алгоритм:
ratio = min(|y|,|x|) * 128 / max(|y|,|x|), LUT lookup, quadrant correction. ~10
операцій замість 128.\
**Валідація:** `omega_v2/src/math.rs` — `atan2_fast` портовано в Rust і
верифіковано brute-force O(256) scan з i64 dot product для 64 точок (±1
tolerance). Додано 2 unit tests.

---

## 7. Medium Issues (architecture smell)

### MED-1: KURAMOTO_SAKAGUCHI_ALPHA = 77 (F-02)

Немає документації, чому 77. Якщо це golden angle (~137.5°), то має бути 97.8
(при 256-step phase). Якщо це ~60°, то 42.6. 77 — ні те, ні інше.

### MED-2: SECTOR_DIVISOR = 73 (F-03)

При 128 секторах, `sector_index = absolute_phase >> (q_phase - q_sectors)`. Це
O(1) bitshift. Навіщо 73? Можливо, залишок від старої версії з `% 73`?

### MED-3: Frame-based season (F-27)

`Math.floor(frameCount / 3600) % 4` — прив'язка до `requestAnimationFrame`
(теоретично 60 FPS). На 144Hz моніторі сезон триває 25 секунд. На 30 FPS — 2
хвилини. Недетерміновано.

### MED-4: XOR mutation mask 0b01010101 (F-16)

Мутація завжди інвертує парні біти. Це не mutation — це static transform. Genome
дитини = genome батька ⊕ 85 завжди. Немає випадковості.

---

## 8. Waste Patterns

| Патерн                           | Локація                | Опис                                                                                                          |
| -------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| **LCG spectral bias**            | `lattice.rs:102`       | Numerical Recipes LCG має поганий Spectral Test. 3D-точки лягають на гіперплощини. Для 1M агентів це помітно. |
| **8-bit genome in 32-bit field** | `lattice.rs:112`       | ✅ FIXED: тепер використовується повний 32-bit seed.                                                          |
| **Modulo in hot path**           | `constants.rs:93`      | ✅ FIXED: `& 0xFF` замість `% 256`.                                                                           |
| **Linear consonance**            | `pure_lambda.ts:99`    | ✅ FIXED: log-tolerance.                                                                                      |
| **Fixed telemetry interval**     | `bootstrap/v2.ts:133`  | `frameCount % 60` — при зміні FPS телеметрія пливе.                                                           |
| **f64 trig non-determinism**     | `lambda.rs:266`        | `sin/cos/atan2` на f64 — біти можуть відрізнятися на x86 vs ARM.                                              |
| **ABI mismatch CPU fallback**    | `phase_compute.ts:300` | ✅ FIXED: коректні offsets.                                                                                   |

---

## 9. Рекомендації (по пріоритету)

### P0 — ✅ ВСІ CRIT ВИПРАВЛЕНО (2026-04-24)

- **CRIT-1** — negative drift wrap: arithmetic shift i32
- **CRIT-2** — genome truncation: full 32-bit seed + stochastic mutation
- **CRIT-3** — golden trace N<1024: adaptive skip
- **CRIT-4** — CPU fallback ABI: correct offsets
- **CRIT-5** — u32 overflow: u64 intermediate cast
- **CRIT-6** — q_phase guards: assertion in new/set_environment
- **CRIT-7** — atan2_u8 overflow: i64 intermediate
- **CRIT-8** — wrap_index: rem_euclid
- **CRIT-9** — 0.92*1024≠96: comment fixed
- **CRIT-10** — harmonics=0: guard clause

### P0 — Виправити CRIT-6 (topology q_phase guards)

Додати `assert!(q_phase >= 2 && q_phase <= 7)` у `PhaseTopology::new` і
`set_environment`.

### P0 — Виправити CRIT-7 (atan2_u8 i32 overflow)

Використовувати `i64` проміжок: `(a as i64) * 128`.

### P0 — Виправити CRIT-8 (wrap_index для не-power-of-2)

Замінити `value & (modulo - 1)` на `value.rem_euclid(modulo)`.

### P0 — Виправити CRIT-9 (0.92 * 1024 ≠ 96)

З'ясувати правильний threshold (92% чи 9.4%) і синхронізувати код з коментарем.

### P0 — Виправити CRIT-10 (harmonics = 0)

Додати `assert!(harmonics > 0)` у конструктор `PhaseLatticeField`.

### P1 — Замінити LCG на xorshift64\*

```rust
fn xorshift64(state: u64) -> u64 {
    let mut x = state;
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    x
}
```

Швидше, кращі spectral properties, period 2^64-1.

### P1 — Вивести всі thresholds з Q-scale

```rust
const MITOSIS_THRESHOLD_FRAC: u32 = 32768; // 50% in Q16
let threshold = (MAX_ENERGY * MITOSIS_THRESHOLD_FRAC) >> 16;
```

### P2 — Bitmask замість modulo

```rust
// (to_theta + 256 - from_theta) % 256
→ to_theta.wrapping_sub(from_theta) & 0xFF
```

### P2 — Log-tolerance для consonance

```typescript
const LOG_TOLERANCE = 0.07; // ≈ 5%
function isConsonant(ratio: number, target: number): boolean {
  return Math.abs(Math.log2(ratio) - Math.log2(target)) < LOG_TOLERANCE;
}
```

### P3 — Детермінований season

Замінити frame-based на tick-based:

```typescript
const season = Math.floor(signals.absolute_tick / 3600) % 4;
```

---

## 10. Формульна резюме

```text
Концептуальна формула OMEGA-64 (спрощена):
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  agent.phase[t+1] = (agent.phase[t] + (base_freq >> 20)) & phase_mask       │
│                                                                             │
│  agent.energy[t+1] = agent.energy[t] - metabolic_burn + resonance_bonus     │
│                                                                             │
│  metabolic_burn = 1 + popcount(genome) / 4                                  │
│                                                                             │
│  resonance_bonus = 150  if  phase ≡ 0 (mod 64)  else  0                    │
│                                                                             │
│  mitosis_trigger = energy >= 2000                                           │
│                                                                             │
│  child.genome = parent.genome XOR 0b01010101                                │
│                                                                             │
│  golden_trace = Σ (agent[i*1024].phase * 31 + agent[i*1024].energy)         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Висновок:** Фундамент Q10/Q20 fixed-point — коректний і детермінований. Але
шар біологічних констант (metabolism, mitosis, mutation) побудований на magic
numbers без derivation з базової фізики. Це створює «невидимі ручки», якими
користувач (або Оракул) не може керувати. Рекомендується формалізувати всі
thresholds як похідні від `topology.q_phase`, `Q20_SCALE`, та `MAX_ENERGY`.
