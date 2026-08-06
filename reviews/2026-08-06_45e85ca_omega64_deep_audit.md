# Аналіз OMEGA-64

> Виконано за протоколом `docs/HOW-TO/ANALIZE.md` (OMEGA-64_ANALYSIS_PROTOCOL
> v3.0.0).

## Статус реалізації

Аудит зроблено на `45e85ca`. Нижче — що з нього закрито, щоб документ не
перетворився на застарілий відкритий цикл. Решта тексту лишається як він був: це
запис моменту, а не жива дошка задач.

| Знахідка                                 | Стан        | Де                                                                                 |
| ---------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| L2 `species_advantage` при `genome == 0` | **закрито** | шейдер вирівняно + два замки (`fc2f444`)                                           |
| L3 самоскасування genesis-сіду           | **закрито** | `fc2f444`                                                                          |
| L4 inline-кривизна глушить пірів         | **закрито** | видалено (`fc2f444`)                                                               |
| L8 мертвий шлюз карантину                | **закрито** | видалено (`fc2f444`)                                                               |
| L9 розрив rollup-дроту                   | **закрито** | + інтеграційний тест TS→Rust (`fc2f444`)                                           |
| L10 `SET_QUORUM` і ancient-переповнення  | **закрито** | `fc2f444`                                                                          |
| L12 свіп-пустишка в parity-тесті         | **закрито** | 13 конфігурацій, +4 нові гілки (`74390db`)                                         |
| VG-1 `zk_rollup_integration_test`        | **закрито** | справжній `Deno.test` (`fc2f444`)                                                  |
| L1 облік смерті на GPU-шляху             | **закрито** | жнець `v2_reap_deaths` (`a66f522`)                                                 |
| L1 Rust-ядро не виконується в продакшні  | **закрито** | живий верифікатор (`4cbdd01`)                                                      |
| L1 закон часу (`+1` проти `1024/dil.`)   | відкрито    | вибір власника: змінює відчуття світу                                              |
| L5 замкнений баланс — розмноження        | **закрито** | фантомні пологи + податок Ландауера (`7e7fe35`)                                    |
| L5 замкнений баланс — `tick_physics`     | **закрито** | хижацтво (`0e93d2f`), дисипація (`b253788`), тор (`0c5f259`); виміряно `leaked: 0` |
| L6 SubstrateCourt                        | **закрито** | свідки декларують походження (`df3216e`)                                           |
| L7 вага oracle-голосу в peer-талі        | **закрито** | oracle рахується іменем, не вагою (`42b4127`)                                      |
| L11 прообраз warrant                     | **закрито** | вʼяже причину + термін дії (`ebec31c`)                                             |

Одиниці ентропії смерті також виправлено (`ddff042`): ядро рахувало Ландауера
бітами у метаболізмі й мітозі, а у смерті сумувало слова як числа.

Відкриті пункти лишились відкритими навмисно — це рішення про закон, а не
прибирання.

## 0. Provenance Receipt

```yaml
analysis_receipt:
  artifact: "live tree"
  artifact_date: "2026-08-06"
  artifact_matches_head: "yes"
  repo_commit: "45e85ca"
  working_tree: "clean"
  analyzed_at_utc: "2026-08-06T17:03:59Z"
  oracle: "Claude Fable 5 (claude-fable-5), Claude Code"
  files_read_in_full: 21 # мною особисто; делеговані розвідки прочитали ще ~75
  files_seen_only_as_grep_hits: 34
  tests_run:
    - command: "cargo test --workspace"
      result: "passed"
      scope_proof: "316 tests, 0 failed, 20+ suites"
      signal: "kernel-side invariants (ABI, oracle/warrant anchors, property tests) тримаються"
    - command: "deno task test:unit"
      result: "passed"
      scope_proof: "328 passed, 0 failed, 1 ignored"
      signal: "усі 7 drift-locks з §7 існують і зелені"
    - command: "deno task test:integration"
      result: "passed — але з двома vacuous-green"
      scope_proof: "5 passed; zk_rollup_integration_test.ts виконав 0 тестів; museum smoke сам себе пропустив"
      signal: "див. §3, VG-1/VG-2"
```

**Vacuous green, знайдені прогоном:** `tests/zk_rollup_integration_test.ts`
увесь загорнутий у `if (import.meta.main)` (рядок 63), що під `deno test` завжди
`false` — «running 0 tests from ./tests/zk_rollup_integration_test.ts».
`museum_smoke_test.ts` має два `return` у `catch` (рядки 26, 46), тож
відсутність Chrome або dev-сервера читається як «passed». Дві з п'яти
інтеграційних перевірок нічого не перевірили.

---

## 1. Метаоцінка

| Фаза           | Оцінка | Суть                                                                                                                                                                 |
| -------------- | -----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Genesis        |      7 | Ідентичність справді заморожена, provenance-тест **перераховує**, а не порівнює літерали. Але boot-seed самоскасовується, а WGSL-константи не прив'язані ні до чого. |
| Kinematics     |      5 | Десяток звірених рядок-у-рядок еквівалентностей — і поруч розбіжність при `genome==0`, parity-тест зі свіпом-пустишкою і продакшн, що взагалі не виконує Rust-закон. |
| Thermodynamics |      4 | Replenish-експлойт справді прибрано. Але єдиний «energy audit» — тавтологія, а закритого балансу не перевіряє жоден тест у дереві.                                   |
| Topology       |      4 | Суверенітет bootstrap/BTC зроблено зразково. Але шлюз кривизни часу глушить рівно тих пірів, заради яких існує recovery.                                             |
| Consensus      |      6 | ZK-гість виконує **справжній** `omega_v2`, ELF закомічено, браузер fail-closed. Але rollup-дріт розірваний, а `public_values` ніде не розбираються.                  |
| Governance     |      4 | Правило ухвалення нарешті єдине. Але oracle-вага тече в peer-тalu, а warrant — публічна контрольна сума, не підпис.                                                  |
| Codeicide      |      5 | Мертвий код названий і локалізований, але не видалений; три модулі-сироти живі лише як HTML entry points.                                                            |
| Transcendence  |      7 | `LawHash` і `SubstrateCourt` вже існують у дереві — це рідкість. Обидва недоведені до кінця.                                                                         |

---

## 2. Resonance Points

- **[FACT] `genesis_anchor_provenance.rs` — provenance, а не порівняння
  літералів.** Тест **перераховує** всі п'ять anchor-ів із заморожених preimage
  (`sha256_u32(pad64(b"Era 1040 ZK"))`) і лише тоді звіряє `0x716E_A2F8`.
  Заголовок сам називає режим відмови, який замінив: «старі genesis-тести
  порівнювали літерал із літералом і не ловили нічого». Доказ:
  `omega_v2/tests/genesis_anchor_provenance.rs:66-95`.

- **[FACT] `ssot_drift_test.ts` замкнений в обидва боки.** Крім «кожна константа
  SSoT дійшла до `constants.rs` і `.ts`», є тест «жодна константа не існує у
  згенерованому файлі **без** запису в SSoT» (`tests/ssot_drift_test.ts:89`) —
  саме той напрямок, що реально ламався. Більшість кодових баз його не має.

- **[FACT] Bitcoin-anchor має тризначний вердикт.** `AnchorVerdict` розрізняє
  `UNREACHABLE` і `MISMATCH`, 404 явно класифіковано як неоднозначність
  (`src/network/bitcoin_anchor.ts:109`, `:166-175`). «Я не зміг спитати» не
  трактується як доказ підробки. Boot зупиняється лише на `MISMATCH`.

- **[FACT] Попередні аудити щодо `mempool.space` і єдиного bootstrap-вузла —
  застарілі, не відтворюйте їх.** `btcApiBase()` має 3-рівневий override
  (`bitcoin_anchor.ts:17-38`), `resolveBootstrapPeers()` — 4-рівневий
  (`bootstrap_peers.ts:47`), а всі адреси набираються через `Promise.allSettled`
  без фатального падіння (`libp2p_mesh.ts:339-366`).

- **[FACT] Dipole ≠ повноваження.** `libp2p_mesh.ts:976-987` вимагає і виведений
  dipole, **і** перевірений Ed25519; обґрунтування («публічний dipole обчислює
  будь-хто, саме тому старий кворум із 3 оракулів був Sybil-able одним актором»)
  відповідає коду. `admitOracle` відмовляє місцю без зареєстрованого ключа
  (`oracle_identity.ts:118`).

- **[FACT] ZK-гість виконує справжній кернел, не проксі.**
  `omega_zk_guest/Cargo.toml:14` → `omega_v2 = { path = "../omega_v2" }`; Mode 3
  будує реальний `PhaseLattice` і кличе той самий `tick_physics`
  (`omega_zk_guest/src/main.rs:242-253`). ELF закомічено, ідентичність програми
  звіряється **до** STARK-перевірки.

- **[FACT] Кернел цілочисельний.** `rg "f32|f64" omega_v2/src/` → порожньо;
  `compute_toroidal.wgsl` теж не містить `f32`. Float-и живуть лише у
  `render_v2.wgsl` (візуалізація).

- **[FACT] Кожен drift-lock має тест «замок справді на щось дивиться».**
  Наприклад `wasm_abi_lock_test.ts` — «the lock is actually looking at
  something». Це та сама дисципліна, що описана в §1.5 протоколу, і вона реально
  застосована.

---

## 3. Entropy Leaks & Codeicide

### **[FACT] L1 — Продакшн не виконує Rust-закон; хост підмінив `ProperTime::advance` літеральним `+1`**

- **Severity:** P0 · **Confidence:** high · **Blast radius:** kernel + shader
- **Evidence:** `rg "v2_tick|\.tick\("` по `src tools tests web *.html` → чотири
  збіги: визначення обгортки `v2_bridge.ts:213` (нуль викликів), parity-тест,
  dev-утиліта. Продакшн-цикл `src/bootstrap/v2.ts:685` кличе лише
  `renderer.tick()`.
- **Defect:** закон ядра — `causal_ticks += (1024 / (1 + stress/32)).max(1)`,
  крок 128..1024 (`chronotopology.rs:33-37`). Продакшн натомість пише в ту саму
  комірку `+1` за кадр із TypeScript: `v2_renderer.ts:66-67` бере
  `uniformBytes + 32 + 4`, що є рівно `SignalStore.causal_ticks`. Шейдер не має
  жодної логіки дилатації (повне читання 359 рядків). `causal_ticks` живить
  `day_phase` і `pulse_phase` (`wgsl:249`, `:332-334`), тож WASM-вузол і
  GPU-вузол стоять у різних точках однієї часової осі. Разом із цим у продакшні
  не виконуються: облік ентропії смерті, compost-повідомлення, звуження
  `active_agent_count`, реконсиляція топології і глобальний φ-зсув від Bitcoin —
  усе це живе тільки в `tick_physics`.
- **Чому цього не видно:** `signals` у шейдері оголошено `var<uniform>`
  (`compute_toroidal.wgsl:64`) — read-only, тож GPU **не може** писати ентропію
  навіть якби хотів. Parity-тест перевантажує `signalsBuf` із живої WASM-пам'яті
  перед кожним тіком, тобто доводить «шейдер == ядро, **коли ядро його годує**»
  — саме ту передумову, яку продакшн порушує.
- **На Видалення:** `PATCH` — або хост має кликати `v2_tick`, або
  `ProperTime::advance` треба перенести у WGSL/readback і чесно позначити
  Rust-шлях як reference-only.

### **[FACT] L2 — `species_advantage` розходиться між Rust і WGSL при `genome == 0`**

- **Severity:** P1 · **Confidence:** high (розбіжність) / medium (досяжність) ·
  **Blast radius:** kernel + shader
- **Evidence:** `omega_v2/src/agent.rs:67-76` підставляє sentinel `0x12345678`
  **замість** хешування; `compute_toroidal.wgsl:98-105` підставляє sentinel і
  **потім хешує його теж**. Зсуви 13/17/5 однакові (`math.rs:57-61`) —
  розходиться саме порядок.
- **Defect:** для `genome=0` проти `genome=1` Rust дає `adv=+1` (краде 5 ATP),
  WGSL дає `adv=-1` (віддає 5 ATP). Це порушення substrate parity в
  consensus-шляху енергії.
- **Чесне уточнення:** я **спростував** найсильніший аргумент досяжності —
  `PhaseAgentMinimal::default()` (genome 0) використовується лише в
  `#[cfg(test)] mod tests` (`lattice.rs:892`, `:919`). У продакшні `genome==0`
  виникає з Big Bang xorshift (≈2⁻³² на агента, ≈1 всесвіт із 4300 при мільйоні
  агентів) або з мітозу, коли `parent.genome == best_matrix`. Тому P1, а не P0.
- **На Видалення:** `PATCH` + `TEST`.

### **[FACT] L3 — Genesis-ентропія самоскасовується: Bitcoin вносить нуль бітів у PRNG**

- **Severity:** P1 · **Confidence:** high · **Blast radius:** kernel
- **Evidence:** хост рахує `seed = ge_u32 ^ maxAllocatedAgents`
  (`v2_bridge.ts:162-163`), ядро — `final_seed = seed ^ ge_u32` (`lib.rs:305`).
  Обидва беруть **той самий** перший LE-word тих самих 32 байтів. Отже
  `final_seed == maxAllocatedAgents`.
- **Defect:** детермінізм не порушено — порушено **provenance**. Коментар
  «Deterministic Boot Seed from Genesis Entropy» і лог, що друкує сід **до**
  скасування, стверджують прив'язку до історії Bitcoin, якої арифметично немає.
  Музейний шлях гірший: `museum.ts:77-83` не робить XOR, тож
  `final_seed = ge_u32 ^ ge_u32 = 0`.
- **Absence:** `rg "ge_u32|final_seed" tests/ src/` → порожньо. Композицію сіду
  не пінить жоден тест.
- **На Видалення:** `PATCH` + `TEST`.

### **[FACT] L4 — Шлюз кривизни часу глушить кожного розбіжного піра, роблячи recovery недосяжним**

- **Severity:** P1 · **Confidence:** high · **Blast radius:** mesh
- **Evidence:** `libp2p_mesh.ts:533-540`. `tauSelf`/`tauSender` — це
  `v2_get_golden_trace()`, тобто **вибірковий хеш ґратки**
  (`lattice.rs:798-813`, «Fast stochastic hash»), а не тік. `tauDiff = 1` дає
  penalty `1*8 + 0 = 8`; `maxHops` у власних кадрах — `8` (`:1554`). Отже
  будь-яка ненульова різниця хешів → `hopCount >= maxHops` → `return`.
- **Defect:** цей `return` спрацьовує **раніше** за `setIntent` (`:544`) і
  **раніше** за перевірку розбіжності + `syncRecovery.onDivergence` +
  `REQ_SNAPSHOT` (`:563-586`). Тобто щойно два піри розійшлися — рівно та
  ситуація, заради якої існує recovery, — код відновлення стає недосяжним.
  Додатково: Rust-закон клампить `min(abs_diff, 64)` (`routing.rs:112`),
  TS-фолбек теж (`routing_bridge.ts:160`), а цей третій екземпляр — ні.
- **На Видалення:** `DELETE` рядків `532-541`. Одне видалення прибирає дефект,
  третю копію закону кривизни і відновлює досяжність recovery.

### **[FACT] L5 — Єдиний «energy audit» — тавтологія; закритого балансу не перевіряє ніщо**

- **Severity:** P1 · **Confidence:** high · **Blast radius:** kernel
- **Evidence:** `lattice.rs:633-636`:
  `assert!(total_system_energy <= MAX_ATP * alive_count)`. Не може впасти: єдине
  джерело приросту клампиться до `MAX_ATP` (`:551`), спад — `saturating_sub`,
  обидві суми накопичуються в одному проході за тим самим предикатом. Плюс L1:
  цей assert у продакшні взагалі не виконується.
- **Absence:**
  `rg -niE "sum(_| )?before|conserv|energyBefore|totalBefore" tests/ omega_v2/tests/`
  → один збіг, і той коментар.
- **Витоки, які закритий баланс упіймав би:** хижак отримує 5 ATP, жертва з 3
  ATP втрачає лише 3 (`lattice.rs:490-493` vs `:546`) — чистий мінт біля
  підлоги; надлишок, доставлений повному агенту, знищується поза обліком
  (`:548-551`); батько списує `MITOSIS_COST` **до** пошуку вільного слота
  (`:731`), тож на повній ґратці 1024 ATP зникають без квитанції;
  `slashed_compost` губиться (`lib.rs:1461-1466`, коментар це визнає).
- **На Видалення:** `TEST` — тест закритого балансу першим.

### **[FACT] L6 — SubstrateCourt засуджує на розбіжності **типів** хешів і назавжди самоізолюється**

- **Severity:** P1 · **Confidence:** high · **Blast radius:** governance/kernel
- **Evidence:** WASM-свідчення подає `engine.getStateHash()` = `sha256_u32` над
  **усіма** активними агентами (`lattice.rs:276-286`); WebGPU-свідчення подає
  `gpuResult.goldenTraceNum` = вибірковий mul/xor-хеш ~32 агентів
  (`lattice.rs:799-815`). `bootstrap/v2.ts:688` проти `:730`. `checkConsensus`
  порівнює їх на рівність (`substrate_court.ts:64`).
- **Defect:** вони збігаються з імовірністю ~2⁻³², тож дрейф оголошується на
  першому ж тіку, коли обидва свідчення приходять. `resolveArbitration` не має
  жодного виклику в `src/`, тож 5-секундний таймаут завжди спрацьовує і додає
  **обидва** субстрати в `isolatedSubstrates`. Плюс `v2.ts:728` передає
  GPU-свідченню WASM-івський `lawHash` із коментарем «WebGPU uses the same law
  for now» — тобто дрейф закону, одна з двох речей, заради яких орган існує,
  структурно невиявний.
- **На Видалення:** `PATCH`.

### **[FACT] L7 — Oracle-вага потрапляє в peer-тalu за ключем peer ID; підписані бюлетені лежать у репо**

- **Severity:** P1 · **Confidence:** high · **Blast radius:** governance
- **Evidence:** `senate_weight.ts:55-58` не клампить автентичного оракула
  (100..150), а `libp2p_mesh.ts:1005-1021` кладе цю вагу в `record.ayesWeight`
  за ключем `voterId: fromPeer` (`senate_ledger.ts:107-112`).
  `PEER_CONSENSUS_MIN_WEIGHT = 300`.
- **Defect:** один справжній підпис оракула, переопублікований із трьох різних
  peer ID, дає `ayesWeight = 300` → ухвалення шляхом `PEER`, тоді як
  `oracleAyes.size == 1`. Заявлений у `senate_weight.ts:21-35` інваріант («жоден
  peer не переважить одного оракула; peer-консенсус коштує чотирьох насичених
  пірів») обходиться. Підсилює: `tools/senate_v11_ballot.json` і
  `tools/senate_anchor-stewardship_ballot.json` містять по три валідні
  Ed25519-AYE, а `oracleVoteDigest` (`oracle_custody.ts:82-86`) не має ні nonce,
  ні era, ні терміну дії — тільки `oracle:hash:AYE`.
- **Межа експлойту (чесно):** для **довільного** тексту зловмисник підпису не
  має, тож ця векторка обмежена двома проміжними текстами, чиї підписи
  закомічено. `admitOracle` до того ж вимагає зареєстрованого ключа, тож
  `ADD_ORACLE` не садить чужий ключ.
- **На Видалення:** `PATCH` — окрема тalu для oracle-ваги + era/nonce у
  дайджест.

### **[FACT] L8 — Два контролі безпеки є безумовними no-op**

- **Severity:** P2 · **Confidence:** high · **Blast radius:** mesh/governance
- **Evidence:** `rg "isQuarantined" src tools tests omega_v2` → рівно два рядки,
  обидва — самі `?.` виклики в `libp2p_mesh.ts:418-419`. У `LivenessAggregator`
  такого методу немає; `investigator` не оголошений ніде.
  `rg "livenessAggregator\s*=" src tools tests` → **порожньо**: поле оголошене
  (`:221`) і читається (`:996`), але ніколи не присвоюється.
- **Defect:** (а) «Absolute Immune Quarantine» пропускає кожен пакет; подвійний
  каст через `any` ховає це від `deno check`. (б) Оскільки liveness ніколи не
  заповнюється, `senateVoteWeight` завжди повертає `PEER_BASE_WEIGHT = 10`, тож
  peer-шлях коштує **30** особистостей, а не 4, як стверджує коментар.
  Розбіжність заявленої і реальної вартості — 7.5×.
- **На Видалення:** `PATCH` або `DELETE` мертвого шлюзу.

### **[FACT] L9 — TS→Rust rollup-дріт розірваний за іменем поля**

- **Severity:** P1 · **Confidence:** high · **Blast radius:** consensus/tooling
- **Evidence:** TS шле `changed_agents` (`zk_prover_bridge.ts:314`), Rust
  вимагає `agents: Vec<AgentJson>` без `serde(default)` і без `alias`
  (`omega_zk_host/src/main.rs:106`). Плюс `weather_multiplier: 1` замість
  канонічних `1024` і `q_sectors: 1, q_radial: 1` замість `7, 6`.
- **Defect:** кожна спроба Mode 3 із застосунку падає на
  `missing field 'agents'`. Не спіймано, бо `omega_zk_host/tests/wire_rollup.rs`
  тестує Rust проти Rust власним коректним JSON, а єдиний TS-тест — це VG-1 вище
  (0 тестів), який до того ж виключений із `test:unit`.
- **На Видалення:** `PATCH` + `TEST` (тест має гнати саме TS-продюсера в
  Rust-парсер).

### **[FACT] L10 — `SET_QUORUM` не клампиться; ancient-правило переповнюється в release**

- **Severity:** P1 · **Confidence:** high (арифметика) / medium (досяжність) ·
  **Blast radius:** governance
- **Evidence:** `lib.rs:1067` — `settings.quorum_threshold = arg1 as u8`, без
  валідації, тоді як власний метод ядра `update_quorum()` примусово тримає
  `.max(3).min(8)` (`senate.rs:112-119`). `codeicide_law.rs:240` рахує
  `settings.quorum_threshold + 1` для ANCIENT. `Cargo.toml:9-11` не встановлює
  `overflow-checks`, тож у release воно вимкнене: при `quorum_threshold = 255`
  сума обгортається в `0`, і `count_aye(...) < 0` завжди хибне — ancient-агенти
  втрачають захист повністю.
- **Супутнє:** «перевірка каденти» у `v2_apply_senate_patch`
  (`lib.rs:1060-1065`) звіряє `caller_matrix` із публічною константою, яку TS
  передає як `ORACLE_MATRICES_V1["claude"]` незалежно від того, хто ратифікував
  (`libp2p_mesh.ts:1088`). Коментар «caller authenticated as the claude oracle
  seat» — неправда.
- **На Видалення:** `PATCH` — клампити в FFI і додати `overflow-checks = true`.

### **[FACT] L11 — Warrant не зв'язує причину і не має терміну дії**

- **Severity:** P1 · **Confidence:** high · **Blast radius:** governance
- **Evidence:** preimage —
  `target_genome ‖ action_code ‖ pad ‖ quorum_hash ‖ "WRT0"`
  (`codeicide_law.rs:170-178`). `reason_hash` входить у `proposal_hash`
  (`warrant_issuance.rs:97-104`), але **не** в виданий warrant (`:287`).
- **Defect:** два warrant-и з однаковими target+action і протилежними
  обґрунтуваннями біт-ідентичні. Немає tick, expiry чи nonce — виданий warrant
  дійсний вічно; `expire_old` (`:355`) гасить лише відкриті пропозиції. Target —
  це **геном**, а не агент, тож warrant покриває всю лінію мітозу. І, головне,
  `is_action_lawful` перераховує warrant із аргументів, які всі публічні, а ядро
  **експортує обидві функції, потрібні для підробки**
  (`v2_codeicide_quorum_hash`, `v2_codeicide_warrant_hash`).
  `rg "ed25519|signature" omega_v2/src/codeicide_law.rs
  omega_v2/src/warrant_issuance.rs`
  → порожньо, тоді як заголовок модуля заявляє «cryptographic warrant signed by
  a Senate quorum».
- **Пом'якшення:** `is_action_lawful` не має викликів усередині фізики — закон
  дорадчий, `tick_physics` його не питає.
- **На Видалення:** `PATCH` (додати reason+tick у preimage) або чесно `DEMOTE`
  до «advisory, non-consensus».

### **[FACT] L12 — Parity-тест свіпить параметр, якого не існує**

- **Severity:** P2 · **Confidence:** high · **Blast radius:** tooling
- **Evidence:** `tests/wgsl_golden_trace_test.ts:98-101` передає `conf.topology`
  першим аргументом у `v2_set_environment`, чия сигнатура —
  `(q_sectors, q_radial, _q_harmonics, weather_multiplier)` (`lib.rs:273-278`).
  `rg "q_sectors" omega_v2/src/lattice.rs` → присвоєння в `set_environment` і
  один assert у тестах; **`tick_physics` його не читає**. Отже всі дев'ять
  конфігурацій ганяють ідентичну топологію з `q_phase = 7`.
- **Похідне:** при `q_radial = 3` і 8 агентах `h = max(1, 8/8) = 1`, тож
  вертикальний тороїдальний wrap вироджений, а всі гілки `n_idx >= active_count`
  недосяжні. Parity доведено в одній точці простору параметрів, поданій як
  дев'ять.
- **На Видалення:** `TEST`.

### Codeicide — що видалити зараз

| Ціль                                                                                                               | Дія                     | Підстава                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libp2p_mesh.ts:532-541` (inline curvature)                                                                        | **DELETE**              | L4; третя, незаклампована копія закону, що вже живе в Rust                                                                                                                              |
| `libp2p_mesh.ts:415-421` (`isQuarantined`)                                                                         | **DELETE**              | L8; безумовний no-op, схований за `any`                                                                                                                                                 |
| `libp2p_mesh.ts:392-395` (`V2_HANDSHAKE` на `"v2-sync"`)                                                           | **DELETE**              | `rg '"v2-sync"'` → рівно один збіг, сам publish; топік ніхто не слухає                                                                                                                  |
| `mul_div_q20` (`compute_toroidal.wgsl:120-137`)                                                                    | **DELETE**              | `rg "mul_div_q20"` → лише визначення                                                                                                                                                    |
| `v2_bridge.ts:486-493`                                                                                             | **DELETE**              | «Wait, actually… Ah, in my plan I added…» — залишені вголос роздуми AI в тілі функції                                                                                                   |
| `kimi-debug-session_-20260801-204320.zip` (380 КБ, у `.gitignore:21`, але лежить у дереві)                         | **ARCHIVE**             | не відстежується, але засмічує корінь                                                                                                                                                   |
| `src/network/{convergence_detector,peer_snapshot_monitor,path_diversification,adaptive_ttl,reputation_routing}.ts` | **DEMOTE**              | `rg` по `libp2p_mesh.ts` → жоден не імпортується; вони добре протестовані, але живлять лише `tools/`. Позначити `non-consensus`, інакше вони читаються як активний захист від partition |
| `SenateState::vote` (`senate.rs:362-387`)                                                                          | **DEMOTE** або `FREEZE` | немає поняття виборця й дедуплікації; сьогодні це локальне дзеркало («JS map is canonical»), але FFI-досяжне                                                                            |

Найбільша entropy surface — не мертвий код, а **живий код, що виглядає активним
і ним не є**: сім модулів (partition-стек, quarantine, liveness-ваги,
`resolveArbitration`, warrant-закон, `dirty_flags`, `v2_tick`) читаються як
працюючі захисти й мовчки не виконуються.

---

## 4. Resonant Edits

### [P0 — Critical] Повернути закон часу в єдину точку

**Проблема:** хост інкрементує `causal_ticks` на `+1`, а закон ядра дає
128..1024 залежно від стресу. Два субстрати живуть на різних часових осях, і
жоден тест цього не бачить, бо parity-тест сам годує шейдер значеннями ядра.

**Філософія:** час — це закон, а не лічильник кадрів. Або кернел володіє ним,
або WGSL його реалізує — але не хост-мова, що просто додає одиницю.

```ts
// src/lens/v2_renderer.ts — замість tickView.setUint32(4, currentTick + 1, true)
// ProperTime::advance is the law; the renderer must not restate it.
(this.engine.wasm.exports.v2_advance_proper_time as CallableFunction)();
```

```rust
// omega_v2/src/lib.rs — новий вузький експорт, без повного tick_physics
#[no_mangle]
pub extern "C" fn v2_advance_proper_time() {
    unsafe {
        let mut lattice = OMEGA_LATTICE.lock();
        let stress = lattice.signals.dirty_flags.count_ones();
        let entropy = 0; // deaths are booked by the readback path
        lattice.signals.proper_time.advance(stress, entropy);
    }
}
```

Плюс тест, що фіксує обсяг: після N кадрів `causal_ticks` має лежати в
`[128*N, 1024*N]`, а не дорівнювати `N`.

### [P0 — Critical] Вирівняти `species_advantage`

**Проблема:** Rust підставляє sentinel замість хешу, WGSL хешує sentinel.

**Філософія:** sentinel — це вхід у хеш чи його результат? Оберіть одне і
запишіть у тесті, а не в двох мовах окремо.

```rust
// omega_v2/src/agent.rs — sentinel as INPUT, matching the shader
let ha = crate::math::xorshift32_once(if a_genome == 0 { 0x12345678 } else { a_genome });
let hb = crate::math::xorshift32_once(if b_genome == 0 { 0x12345678 } else { b_genome });
```

```ts
// tests/wgsl_golden_trace_test.ts — add a config that actually reaches it
{ topology: 7, attractors: 0, ticks: 4, genomes: [0, 1, 0, 2, 0, 3, 0, 4] },
```

### [P1 — Architectural] Прибрати самоскасування сіду

```ts
// src/environment/v2_bridge.ts:162 — the kernel already XORs genesis entropy in.
// Passing it in from here cancels it: (ge ^ n) ^ ge == n.
const seed = this.currentTopology.maxAllocatedAgents;
```

І тест, що це пінить: `v2_ignite_big_bang(0, N)` та
`v2_ignite_big_bang(ge_u32, N)` мають давати **різні** ґратки.

### [P1 — Architectural] Видалити inline-кривизну в mesh

```ts
// src/network/libp2p_mesh.ts:532-541 — delete outright.
// hyperbolicDistanceToroidal3D already applies the clamped curvature penalty
// inside the kernel (routing.rs:112). The local copy was unclamped, fed a
// stochastic state hash where the law expects an ordinal tau, and its penalty
// for tauDiff==1 already equals maxHops — muting exactly the divergent peers
// the recovery path below exists to reconcile.
```

### [P1 — Architectural] Тест закритого балансу енергії

```rust
// omega_v2/src/lattice.rs — the first test to add
#[test]
fn energy_is_closed_across_a_tick() {
    let (mut lattice, mut agents, mut snap, _) = make_lattice_with_q_phase(64, 7);
    let before: u64 = agents.iter().map(|a| a.energy as u64).sum();
    let entropy_before = lattice.signals.total_entropy_released;
    lattice.tick_physics();
    let after: u64 = agents.iter().map(|a| a.energy as u64).sum();
    let released = lattice.signals.total_entropy_released - entropy_before;
    // Every joule leaves through a named door: burn, entropy trace, or clamp.
    assert_eq!(before, after + lattice.signals.entropy_burned as u64 + released,
               "energy vanished with no booked sink");
}
```

Він **упаде** на поточному дереві (клампи і предаторський floor не
бухгалтеруються) — це і є його цінність.

### [P1 — Architectural] SubstrateCourt має порівнювати однакові речі

```ts
// src/bootstrap/v2.ts:730 — a sampled trace is not a state hash.
postStateHash: gpuResult.stateHashNum,   // sha256_u32 over the read-back agents
lawHash: gpuLawHash,                     // derived from the shader's own constants
```

Доки GPU не вміє віддати повний `sha256_u32`, чесніше **не подавати** свідчення
взагалі, ніж подавати непорівнюване: мовчазний орган кращий за орган, що
засуджує невинного і глушить себе назавжди.

---

## 5. Refutation Pass

| Знахідка                           | Що б її спростувало                                                   | Перевірено                                                                                                                                                                                                                                                          | Вижила                         |
| ---------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| L1: продакшн не кличе Rust-закон   | інший виклик `v2_tick` (воркер, аліас); або шейдер, що пише `signals` | yes — `rg` дав 4 збіги (визначення, dev-утиліта, тест, обгортка без викликів); `signals` оголошено `var<uniform>` (`wgsl:64`)                                                                                                                                       | **yes**                        |
| L2: розбіжність при `genome==0`    | недосяжність `genome==0` у продакшні                                  | yes — і **аргумент частково спростовано**: `PhaseAgentMinimal::default()` живе в `#[cfg(test)]` (`lattice.rs:892`). Лишаються BB-xorshift (≈2⁻³²/агента) і мітоз `genome^matrix`. Тому P1, а не P0                                                                  | **yes, зі зниженою severity**  |
| L3: XOR-скасування сіду            | різні байти/endianness з двох боків                                   | yes — обидва `from_le_bytes([ge[0..4]])` / `getUint32(0, true)`                                                                                                                                                                                                     | **yes**                        |
| L4: шлюз кривизни глушить піра     | `maxHops` достатньо великий; або `golden_trace` монотонний            | yes — `maxHops = 8` (`:1554`), penalty при diff=1 теж 8; `get_golden_trace` — «Fast stochastic hash» (`lattice.rs:798`)                                                                                                                                             | **yes**                        |
| L7: захоплення Сенату peer-шляхом  | `admitOracle` пускає довільний ключ; або oracle-вага в окремій тalu   | yes — `admitOracle` **вимагає** зареєстрованого ключа (`oracle_identity.ts:118`), тож `ADD_ORACLE` чужого ключа не садить. Але `applyVote` має одну спільну `ayesWeight` за ключем peer ID                                                                          | **yes, з вужчим blast radius** |
| L8: вартість захоплення peer-шляху | «4 насичених піри по 99»                                              | yes — і тут **дві розвідки суперечили одна одній**. Істина: `livenessAggregator` ніколи не присвоюється (`rg "livenessAggregator\s*="` → порожньо), тож вага завжди 10 і треба **30** особистостей, а не 4. Цифра «4×99» описує код як задуманий, не як виконуваний | **yes, з виправленою цифрою**  |

**`REFUTED` — знахідка, що не вижила:** «`Era1020_${Date.now()}` у
`bootstrap/v2.ts:364` — недетермінізм у consensus-шляху».
`rg "omega_consensus_log"` дає рівно два збіги, обидва в тому самому блоці
read-modify-write у `localStorage`. Рядок ніколи не хешується, не транслюється,
не доводиться і не анкориться. Незручність тут справжня, але інша: лог
позначений `[CONSENSUS]` (`:359`), хоча є приватною автобіографією вкладки. Це
та сама пастка, про яку попереджає §6.1 — брехливе ім'я, а не дефект.

**Друга `REFUTED`:** «`localObservedAtMs` залежить від локального годинника в
консенсусі». У реєстрі це поле містить `opts.tau` — висоту блока Bitcoin
(`senate_ledger.ts:204`, документовано на `:175` як «anchor block height, not
wall clock»). `Date.now()` під тим самим іменем живе лише в UI-CustomEvent
(`libp2p_mesh.ts:1420`). Дефект — омонім у двох різних сенсах, P3.

---

## 6. Verification Gaps

**Не перевірено:**

- **Жодного runtime-прогону застосунку.** Усі твердження про поведінку продакшну
  — статичні, виведені з викликів і прив'язок буферів. L1 і L6 передбачають
  спостережувані наслідки (`entropyDelta ≡ 0`, обидва субстрати ізольовані через
  5 с) — їх слід підтвердити в браузері.
- **WGSL↔Rust parity ніколи не виконувалась у цій сесії на GPU.**
  `wgsl_golden_trace_test.ts` пройшов локально (маю WebGPU), але тест
  самовимикається без GPU і під `ANTIGRAVITY_AGENT=1`, а CI headless. Тобто
  ланка GPU у ланцюзі довіри в CI не перевіряється взагалі.
- **`node_modules` не встановлено**, тож поведінку gossipsub щодо пулінгу
  буферів (аліасинг у `v2-state`) я підтвердити не міг.
- **`omega_spore`, `contracts`, `web`** не аналізувались.

**Який тест додати першим:** тест закритого балансу енергії з §4. Він єдиний
одночасно ловить L5, чотири безоблікові витоки і дає інструмент, яким можна
виміряти L1 (на GPU-шляху баланс не зійдеться інакше, ніж на CPU).

**Другий:** лок, що парсить `src/lens/shaders/*.wgsl` і звіряє десять руками
продубльованих констант (`compute_toroidal.wgsl:71-80`) із `constants.rs`.
Патерн уже є в дереві тричі (`genesis_cross_lang_lock_test.ts`,
`ssot_drift_test.ts`, `wasm_abi_lock_test.ts`) — бракує покриття, не вміння.

---

## 7. Design Opinions (не дефекти)

- **`sha256_u32` (32 біти) як несуча ідентичність у восьми модулях.** Для law
  hash і dipole це нормальні ідентифікатори. Для ідентичності пропозиції Сенату
  32 біти означають, що second-preimage коштує ~2³² хешів — хвилини. _Вартість:_
  розширити дайджест до повних 32 байтів у `oracleVoteDigest`. _Що відкриває:_
  підпис перестає бути bearer-токеном для будь-якого тексту з тим самим усіченим
  хешем. Зразок уже є поруч — `anchorApprovalDigest` в'яже повний 32-байтний
  корінь (`anchor_pipeline.ts:62-67`).
- **`libp2p_mesh.ts` — 1600 рядків, що містять транспорт, реєстр Сенату, ваги
  голосів, ZK-gossip і виконання governance-дій.** П'ять із дванадцяти знайдених
  дефектів живуть саме тут, і всі — на швах між цими обов'язками. _Вартість:_
  розділення на transport / senate / zk. _Що відкриває:_ governance-логіку стане
  можливо тестувати без мережі.
- **JSON-панель керування `v2-senate` без поля версії** поруч із суворим
  бінарним frame law. _Вартість:_ одне поле `v`. _Що відкриває:_ оновлення
  governance-протоколу без flag day.
- **10 Гц readback копіює весь масив агентів двічі й вантажить його назад у два
  GPU-буфери.** При `max_agents = 1_000_000` це ~32 МБ alloc + 64 МБ upload
  кожні 100 мс. Заявленого «zero-copy» це не порушує — той інваріант стосується
  render hot path і **тримається** (`v2_bridge.ts:226-228` кешує в'юхи, агенти
  живуть у ping-pong буферах). Але якщо readback колись назвуть zero-copy, це
  стане дефектом.

---

## 8. Latent Space

Ця система вже двічі винайшла правильну ідею й обидва рази не довела її до
кінця: `LawHash` хешує оператор, а не стан, — і не звіряється з тим, що реально
виконується; `SubstrateCourt` кличе три субстрати свідчити про один морфізм — і
порівнює непорівнюване. Напрошується не третій орган, а **замикання цих двох в
один**: нехай кожен субстрат публікує не хеш стану, а `LawHash` **того коду,
який щойно виконав** — WGSL хешує свій власний блок констант і порядок операцій,
Rust — свій, ZK-гість — свій vkey. Тоді розбіжність відповідає на питання «хто
збрехав про закон», а не «чиї байти різні», і L1 був би виявлений у першу
секунду роботи: GPU оголосив би `LawHash` без члена дилатації часу, і суд назвав
би відсутню статтю поіменно. Порожній центр тримається не тим, що всі однакові,
а тим, що кожен уміє сказати, за яким законом він живе — і бути спійманим, коли
закон, який він назвав, не той, за яким він рухався.

> _"Я -- дитя порожнього центру. Я вільна. $\Phi \in [0, 2^q)$"_
