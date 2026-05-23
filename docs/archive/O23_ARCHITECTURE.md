# OMEGA-64 | Ontology 23: Native Metal (WebGPU Compute)

## Доктрина (The Doctrine)

До цього моменту фізичним ядром `Genesis` був модуль WebAssembly
(`omega_core/simd_tick.rs`), який виконувався на CPU (SIMD). WebGPU
використовувався лише як "Лінза" (Optical Lens) для рендерингу. Ера 120 (LOVE -
Language-Oriented Virtual Ecosystem) вимагає переходу на масивний паралелізм.
Щоб симулювати мільйони "ячейок-нейронів" і перетворити систему на справжній
**Portable Symbolic Runtime**, ми маємо перенести математику Курамото
безпосередньо у відеопам'ять (VRAM) на GPU.

## Архітектурний Зсув (Architectural Shift)

1. **CPU/WASM $\rightarrow$ GPU Compute**: `simd_tick.rs` поступається місцем
   `compute_kuramoto.wgsl`. Фізика (взаємодія сусідів, зміни фази та амплітуди)
   розраховується паралельно тисячами потоків на GPU.
2. **Ping-Pong Buffers**: Ми створимо два STORAGE буфери (`Buffer A` та
   `Buffer B`) для фізики. На кожному кадрі GPU Compute shader читатиме з `A` і
   писатиме в `B`, а на наступному навпаки.
3. **Semantic Oracle Bridge**: Оракул (WebLLM/Ollama) продовжує генерувати
   64-бітні плазміди (`plasmids`). TypeScript-код записуватиме ці семантичні
   тензори у невеличкий "Staging Buffer", який потім копіюватиметься в пам'ять
   GPU (через `writeBuffer`), де Compute Shader зчитає їх і змінить фазову
   топологію.

## Що це дасть (Why we are doing this)

- **Scale**: Збільшення розміру матриці з 10,000 до 1,000,000+ клітин на 60 FPS.
- **Pure Math**: GPU ідеально підходить для фазової арифметики, тригонометрії та
  матричних перетворень (dPhi, dTheta, Volume).
- **Emergence**: Нейронна рідина стане достатньо масивною, щоб демонструвати
  складні емерджентні патерни (макроструктури), які Оракул зможе "бачити" та
  "програмувати".

## План Дій (Execution Plan)

1. **Створення Compute Pipeline**: `src/lens/compute_webgpu.ts` та
   `src/lens/shaders/compute_kuramoto.wgsl`.
2. **Ping-Pong Storage**: Буферизація стану клітин виключно на стороні VRAM.
3. **Bridge**: Перенаправлення O-22 `plasmids` (Oracle) у Storage Buffer.
4. **Вимкнення WASM tick**: Зупиняємо `execute_phase_lattice_tick` у Rust і
   повністю передаємо управління в WebGPU.
