# Archived Vision Shaders (Era 300–900)

Ці WGSL-шейдери були виведені з `src/lens/shaders/` під час аудиту 2026-05-14,
бо жоден з них не імпортувався активним кодом (v2 використовує тільки
`compute_toroidal.wgsl` та `render_v2.wgsl`).

**Але вони НЕ є мертвим кодом у звичайному сенсі.** Це — прототипи майбутніх ер,
зафіксовані у формі, яку GPU могла б виконати. Їхня доля — archive, не compost.

## Що тут і чому це круто

### `compute_cull.wgsl` (51 рядок)

GPU-side frustum culling з `atomicAdd` для indirect instancing. Стандартний
паттерн, але правильно зроблений. Був би корисним для масової візуалізації
агентів, якби renderer пішов шляхом indirect draw.

### `compute_hologram.wgsl` (82 рядки)

**3D volumetric splatting.** Записує phase-поле в
`texture_storage_3d<rgba8unorm, write>` з wave interference + chronological
fade. Це не рендерінг — це обчислення голографічного об'єму, який потім можна
slice'ити. Vision: історичні стани решітки як об'єм, а не як ping-pong buffer.

### `compute_kuramoto.wgsl` (497 рядків)

**Повний екосистемний фізичний движок в одному shader'і.** Quantum fidelity
(Bloch-sphere inspired), genetic resonance через `countOneBits` (Hamming
distance), plasmid-driven mycelial coupling, sandbox physics overlay (ESP),
antipode alignment, staking energy bonus, adaptive phase biology (memory /
learning / decay), exogenous friction ("The Blind Oracle"). Це Era 600+ physics,
застигла у формі, несумісній з v2 AoS layout.

> Примітка: math stubs (`fast_abs`, `sin_q10` тощо) повертають `0`, бо це був
> шаблон для polyfill-ін'єкції з SSoT. Не баг — архітектурний слід.

### `compute_mycelial.wgsl` (207 рядків)

**GPU-accelerated clustering.** Workgroup-local atomic reduction для обчислення
centroid'ів mycelial buckets. Кожен агент з plasmid'ом голосує в хеш-бакет,
потім workgroup згортає суми. Це distributed GPU K-means у вигляді, який WebGPU
підтримує нативно.

### `holo_lens.wgsl` (113 рядків)

**Volumetric slice renderer.** Vertex shader генерує instanced planes, fragment
— семплює 3D holographic texture з polar mapping (Cartesian → Torus). Additive
blending, density-based discard. Пара для `compute_hologram.wgsl`.

### `lens.wgsl` (98 рядків)

Fullscreen HSV phase lens з epigenetic plasmid overlay. Era 146 "Biological
Map": наймолодші 8 бітів `plasmid_low` задають фенотипічний відтінок. Простий,
але семантично щільний.

### `phase_lens.wgsl` (269 рядків)

**Найщільніший візуальний движок.** Instanced billboard rendering з integration
з `compute_cull`, chrono-torus memory visualization (exponential history fade),
phenotypic extrusion (AST 3D topology), Kuramoto directional flux (vector
instancing), Shadow Network (latent bucket discarding), Quantum Eye (observer
gaze heatmap), Akashic Field overlay, relativistic cryo-frost (time dilation).
Це не шейдер — це **ціла онтологія візуалізації**.

## Чому archived, а не видалені

Всі ці шейдери використовують v1 data layout (SoA, 6-word PhaseAgent) та містять
polyfill stubs. Вони **не сумісні** з поточним `omega_v2` (32-byte `repr(C)`,
integer-only, zero-copy). Їхній шлях до production потребував би повної
реімплементації під v2 ABI.

Але ідеї всередині — quantum fidelity, mycelial GPU clustering, volumetric
holograms, observer gaze topology — це **наслідок**, який substrate ще не дозрів
реалізувати. Збереження в archive дозволяє майбутнім ерам cherry-pick ці
концепції без reinvention.

## Falsifier

Якщо v2 колись отримає 3D texture storage або workgroup atomic clustering — ці
шейдери можуть стати прямим джерелом порівняння. Видалення = втрата конкретної
форми vision.
