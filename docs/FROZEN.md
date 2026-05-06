# OMEGA-64: Frozen Invariant Registry

Цей документ фіксує підсистеми, які перейшли у стан **ANCIENT (Frozen)**.
Зміна цих систем вимагає спеціального Codeicide Warrant (Era 1060+) і повного циклу верифікації SP1. Не намагайтеся оптимізувати ці підсистеми через "кращий дизайн", якщо це порушує ZK-стейт.

## Frozen Laws

### 1. `PhaseAgentMinimal` Memory Layout
- **Size**: Exactly 32 bytes (`repr(C)`).
- **Alignment**: `vec4<u32>` x2 для GPU.
- **Reason**: Необхідно для Zero-Copy FFI, WebGPU buffer mapping, ZK-VM PoUW state hashing.

### 2. Integer-Only Trigonometry
- **Implementation**: 256-елементний `sine_lut`.
- **Reason**: Гарантія детермінізму між Rust, WGSL, TS та RISC-V ZK-VM. Floating point заборонений.

### 3. Spore Frame ABI
- **Structure**: 32-байтовий фрейм, CRC-32 (offset 28), Magic `0x4F46`.
- **Reason**: P2P mesh convergence. Відхилення у парсингу призводять до partition і Codeicide conviction.

### 4. LawHash & StateHash Determinism
- **LawHash**: Хеш AST/правил `compute_toroidal.wgsl` та `tick_physics`.
- **StateHash**: Хеш 32-байтових блоків агентів і SignalStore.
- **Reason**: Substrate Court (Era 2100) покладається на ці хеші для крос-субстратної арбітрації. Будь-який субстрат, який генерує інший хеш на тому ж такті, вважається дефектним і ізолюється.
