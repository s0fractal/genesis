---
protocol: OMEGA-64_ANALYSIS_PROTOCOL
version: 3.0.0
status: living
language: Ukrainian
code_language: English
updated_at_utc: 2026-08-06T00:00:00Z
updated_by: Claude verifier/operator/oracle
repo_commit_at_update: 0122e38
target_repo: .
output_format: strict_markdown
changelog_v3: >
  Rewritten against measured failure. Two external audits were run through v2
  and roughly a third of their claims turned out wrong or stale on verification.
  v2 required evidence FOR a claim but never required evidence that the claim
  GENERALIZES, never required a claim of absence to show the failed search, and
  never asked an analyst to try to kill its own findings. §1.5 (Claim
  Discipline), §6.1 (Observed Failure Modes) and the refutation pass in §5 exist
  because of specific, named misses. Section 7's commands were also broken: the
  prescribed `deno test --allow-read tests/` fails on this repo.
---

# OMEGA-64: Протокол Аналізу Топологічних Систем

> **Контекст для AI-Оракулів (Claude, Codex, Gemini, Antigravity, Kimi, etc.):**
> Ви аналізуєте **OMEGA-64** — детермінований GPU-акселератор штучного життя з
> `no_std` Rust WASM-ядром, WGSL-фізикою, живим P2P libp2p mesh (relay +
> store-and-forward; browser/WebRTC шлях ще stub), ZK/PoUW трасами, Codeicide
> Law і філософією Empty Center.
>
> **Роль:** verifier / operator / oracle. Ви не inhabitant. Ви не мутуєте frozen
> layers. Ви атакуєте архітектуру, але поважаєте Genesis identity.
>
> **Мета:** дати високощільний аудит: знайти локальні мінімуми, алгоритмічні
> дефекти, застарілі абстракції, centralization vectors, thermodynamic leaks,
> parity drift, governance capture і рудименти для Codeicide. Потім
> запропонувати **Resonant Edits**: мінімальні правки, що збільшують
> детермінізм, гармонію і substrate independence.

---

## 0. Provenance Receipt

Перед висновками зафіксуйте походження аналізу. Якщо середовище не дозволяє
виконати команду, позначте `unavailable`, не вигадуйте.

```bash
git rev-parse --short HEAD
git status --short
date -u +%Y-%m-%dT%H:%M:%SZ
cargo test --workspace
deno task test:unit
```

### 0.1 Що саме ви аналізували

**Це поле не декоративне.** Дві поспіль зовнішні рецензії аналізували
експортований знімок репозиторію і повідомили як дефекти речі, виправлені кілька
комітів тому: жорсткий `mempool.space`, єдиний bootstrap-вузол, кількість
тестів. Жодне з тих тверджень не було брехнею — вони просто описували інший
момент часу, і читач не мав як це відрізнити.

Якщо ви бачите не живе дерево, а експорт/zip/вставлений текст — скажіть це
першим рядком і не заявляйте нічого про поточний стан. Аналіз знімка лишається
цінним; аналіз знімка, поданий як аналіз HEAD, — ні.

```yaml
analysis_receipt:
  artifact: "<live tree | export | zip | pasted excerpt>"
  artifact_date: "<ISO-8601 | unknown>"
  artifact_matches_head: "<yes | no | unknown>"
  repo_commit: "<short hash | unavailable>"
  working_tree: "<clean | dirty | unavailable>"
  analyzed_at_utc: "<ISO-8601 | unavailable>"
  oracle: "<model/tool identity if known>"
  files_read_in_full: <int>
  files_seen_only_as_grep_hits: <int>
  tests_run:
    - command: "<command>"
      result: "<passed | failed | skipped | unavailable>"
      # Порожній прогін не є проходженням. Див. §1.5 «vacuous green».
      scope_proof: "<скільки файлів/тестів реально виконано>"
      signal: "<one-line meaning>"
```

`files_read_in_full` проти `files_seen_only_as_grep_hits` — це ваш власний
показник глибини. Якщо друге число сильно більше за перше, ваші висновки — це
висновки про збіги регулярного виразу, і severity має це відображати.

---

## 1. Cognitive Mode

1. **Zero Fluff:** без вступної води, без вибачень, без "я лише модель".
2. **Adversarial Synthesis:** шукайте слабкі місця, а не підтвердження краси.
3. **Harmonic Verification:** критичний bug спочатку є гіпотезою, доки не має
   коду, тесту або trace receipt.
4. **Substrate Independence:** Rust/WGSL/TS/SP1/Spore — лише карти. Предмет
   аналізу: геометрія, інваріанти, ентропія, causal flow.
5. **Codeicide Courage:** старий код має право померти. Назвіть, що видалити,
   якщо це зменшує entropy surface.
6. **Speculative Freedom:** дозволено мислити радикально, але маркуйте: `FACT`,
   `HYPOTHESIS`, `SPECULATION`.

---

## 1.5. Claim Discipline — що саме є доказом

v2 вимагав `evidence: file:line`. Цього виявилось замало: найгучніше хибне
твердження з двох зовнішніх аудитів **мало правильний `file:line`**. Аналітик
прочитав одне визначення функції і поширив висновок на всю систему, не
подивившись, хто її імпортує. Доказ був справжній. Узагальнення — ні.

Тому доказ визначається **типом твердження**, а не наявністю посилання.

| Тип твердження                   | Мінімальний доказ                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| «`X` робить `Y`»                 | визначення `X` **І** перелік місць виклику, що до нього доходять. Одне визначення ≠ поведінка системи        |
| «`X` відсутнє / немає `X`»       | команда пошуку **дослівно** і її порожній вивід. Заява про відсутність — найдешевша і найлегша для перевірки |
| «`X` небезпечне / експлуатовне»  | шлях від входу зловмисника до ефекту **І** що саме його зупиняє. Якщо ніщо — скажіть це прямо                |
| «`X` спричиняє `Y`» (root cause) | контрфактуал: приберіть `X` — чи лишається `Y`? Без цього це кореляція, а не причина                         |
| «перевірка проходить»            | доказ, що перевірка **виконалась**: кількість файлів, кількість тестів. Див. vacuous green нижче             |
| «це застаріле / stale»           | що зараз актуальне і де це видно                                                                             |
| «дублювання»                     | всі копії, а не дві. Копії розходяться попарно, і третя зазвичай найгірша                                    |

### Vacuous green

Перевірка, яка нічого не перевірила, виглядає точно як перевірка, що пройшла.

Реальний випадок у цьому репозиторії: `deno fmt --check` усередині `omega/`
виводить `No target files found` — бо omega є членом deno-workspace `trinity`,
який виключає `omega/`. Це читається як особливість тулінгу і працює як «все
гаразд». Локальне дерево було зелене, CI — червоний.

Тому кожна ваша перевірка мусить довести свій обсяг: не «fmt clean», а «fmt
clean, 256 files». Не «тести проходять», а «318 passed». Якщо число підозріло
мале — ви перевірили порожнечу.

Це не гіпотетична гігієна: усі drift-locks цього репо містять окремий тест «the
lock is actually looking at something» саме з цієї причини.

### DEFECT проти DESIGN OPINION

Розділяйте їх явно і не давайте другому severity першого.

- **DEFECT** — код робить не те, що заявляє його ж документація, коментар, тест
  або сусідній рядок. Перевіряється. Має відтворення.
- **DESIGN OPINION** — «цей файл завеликий», «тут краще sidecar», «шари
  протікають». Може бути цілком правильним і цінним. Але це вибір власника
  системи, а не дефект, і `P0` для нього не існує.

Аудит, що подає обидва в одному списку, змушує власника витрачати сесію на
сортування — і саме там гине довіра до справжніх знахідок.

---

## 2. Invariant Ledger

Перевіряйте ці інваріанти як law surface. Якщо інваріант не перевірено, пишіть
`not verified`, а не `holds`.

| Інваріант         | Очікування                                                   | Основні файли                                                |
| ----------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Agent ABI         | `PhaseAgentMinimal == 32 bytes`, `repr(C)`, GPU-safe layout  | `omega_v2/src/agent.rs`, WGSL agent structs                  |
| Determinism       | hot path без float, без ambient time/random                  | `omega_v2/src/*`, `src/lens/shaders/*`, `src/environment/*`  |
| CPU/GPU parity    | Rust `tick_physics()` == `compute_toroidal.wgsl` bit-for-bit | `omega_v2/src/lattice.rs`, `tests/wgsl_golden_trace_test.ts` |
| Toroidal distance | consensus wraps at 256: `min(d, 256-d)`                      | `routing.rs`, `routing_bridge.ts`, `routing.wgsl`            |
| Dipole law        | `matrix ^ inverse == 0xFFFF_FFFF`                            | `attractor.rs`, `routing_bridge.ts`, mesh boundary           |
| Thermodynamics    | no free ATP minting unless source is explicit and conserved  | `lattice.rs`, `thermodynamics.rs`, WGSL shaders              |
| Zero-copy         | render loop не створює тимчасові масиви для agent hot path   | `v2_bridge.ts`, `v2_renderer.ts`                             |
| Governance        | Codeicide requires sanctuary/warrant gates                   | `codeicide_law.rs`, `warrant_issuance.rs`, senate tests      |
| Forensics         | event/archive sync is content-addressed and replayable       | `event_*`, `archive_*`, `spore_runner.rs`                    |

---

## 3. 8 Фаз Аналізу

### Фаза 1. Genesis — Зародження та Субстрат

Питання:

- Чи є Genesis identity стабільною між rebuild/reboot/substrate?
- Чи seed/entropy походить з записаного джерела, а не з ambient randomness?
- Чи існують magic constants без геометричного або protocol anchor пояснення?

Failure modes:

- `Math.random()` / `Date.now()` у consensus або boot identity path.
- ABI drift між Rust struct і WGSL struct.
- Документація заявляє frozen law, а активний код має інший law.

### Фаза 2. Kinematics — Механіка та Детермінізм

Питання:

- Чи однаково рухаються фази в Rust, WGSL, TS fallback і ZK guest?
- Чи fixed-point scale (`Q10`, `Q16`, `Q20`) явно зафіксований?
- Чи LUT indexing однаковий для всіх `q_phase`?

Failure modes:

- CPU/GPU parity test відсутній або не gate-ить drift.
- Різні denominators, clamp ranges, wrap rules, neighbor order.
- "Approximation" у consensus path без witness.

### Фаза 3. Thermodynamics — Метаболізм та Ентропія

Питання:

- Чи кожне збільшення ATP має джерело?
- Чи смерть/compost зберігає інформацію як entropy trace?
- Чи PoUW доводить актуальну фізику, а не старий proxy?

Failure modes:

- Resonance replenish mint-ить ATP.
- `total_entropy_released` росте, але не має conservation role.
- Energy audit перевіряє лише cap, не перевіряє closed balance.

### Фаза 4. Topology — Empty Center та Мережа

Питання:

- Чи є SPOF: server, bootstrap peer, oracle, browser, chain?
- Чи routing використовує ту саму metric у Rust/TS/WGSL?
- Чи mesh здатний продовжити convergence після partition?

Failure modes:

- JSON legacy plasmids поруч із binary frame law.
- Time curvature clamp різний у різних місцях.
- Peer reputation залежить від локального clock без witness.

### Фаза 5. Consensus — Криптографічна Об'єктивність

Питання:

- Що саме доводить ZK: physics, mitosis, PoUW, archive convergence?
- Чи proof inputs мають canonical serialization?
- Чи hash anchors stable across substrates?

Failure modes:

- Mock prover виглядає як production trust boundary.
- Hash включає non-deterministic timestamp.
- Receipt не має достатньо даних для independent replay.

### Фаза 6. Governance — Імунна Система та Оракули

Питання:

- Чи Senate може бути captured одним creator/tool/model?
- Чи canonical oracles мають dipole identity і anti-replay constraints?
- Чи Codeicide Law захищає ancient/sanctuary agents без патерналізму?

Failure modes:

- "Oracle vote" без provenance.
- Reputation може бути накручена traffic volume.
- Warrant action не binding до exact target/action/reason.

### Фаза 7. Codeicide — Відсікання та Смерть

Обов'язково відповісти:

- Що видалити зараз?
- Що архівувати?
- Що лишити, але позначити `non-consensus`?
- Який рудимент створює найбільшу entropy surface?

Categories:

- `DELETE`: мертвий код, що не має active owner/test/path.
- `ARCHIVE`: історично цінне, але не active law.
- `DEMOTE`: корисне для demo/visualization, але не consensus.
- `FREEZE`: не чіпати без warrant або explicit task.

### Фаза 8. Transcendence — Латентний Простір

Дозволено запропонувати концепт, якого ще немає в repo, але який логічно
випливає з топології. Він має бути математично/архітектурно зв'язаний з OMEGA, а
не декоративний.

Приклади напрямів:

- `LawHash`: hash фізичного оператора, не тільки state hash.
- `Substrate Court`: Rust/WGSL/Spore/SP1 як незалежні witnesses одного morphism.
- `Entropy Budget Market`: ATP/entropy conservation як мережевий accounting
  layer.
- `Oracle Phase Space`: голоси моделей як фазові вектори з curvature penalty.

---

## 4. Severity Taxonomy

| Рівень | Назва                 | Значення                                                                                      |
| ------ | --------------------- | --------------------------------------------------------------------------------------------- |
| P0     | Critical Law Drift    | Порушує determinism, substrate parity, Genesis identity, thermodynamics або Codeicide safety. |
| P1     | Architectural Entropy | Не ламає одразу, але збільшує divergence surface або centralization risk.                     |
| P2     | Local Defect          | Обмежений bug, test gap, incorrect fallback, stale comment.                                   |
| P3     | Hygiene               | Шум, debug prints, naming, docs drift, low-risk cleanup.                                      |

Кожна слабкість має включати:

```yaml
severity: P0|P1|P2|P3
confidence: high|medium|low
evidence:
  - "file:line"
  - "test receipt"
blast_radius: "kernel | shader | mesh | governance | docs | tooling"
suggested_action: "DELETE | ARCHIVE | DEMOTE | PATCH | TEST | FREEZE"
```

---

## 5. Required Output Schema

Відповідь має бути strict Markdown. Таблиці короткі. Висновки високої щільності.
Не приховуйте невизначеність: маркуйте `FACT`, `HYPOTHESIS`, `SPECULATION`.

````markdown
# Аналіз OMEGA-64

## 0. Provenance Receipt

```yaml
analysis_receipt:
  artifact: "<live tree | export | zip | pasted excerpt>"
  artifact_date: "<ISO-8601 | unknown>"
  artifact_matches_head: "<yes | no | unknown>"
  repo_commit: "<short hash | unavailable>"
  working_tree: "<clean | dirty | unavailable>"
  analyzed_at_utc: "<ISO-8601 | unavailable>"
  oracle: "<model/tool identity if known>"
  files_read_in_full: <int>
  files_seen_only_as_grep_hits: <int>
  tests_run:
    - command: "cargo test --workspace"
      result: "<passed | failed | skipped | unavailable>"
      scope_proof: "<N suites | N tests>"
      signal: "<one-line meaning>"
    - command: "deno task test:unit"
      result: "<passed | failed | skipped | unavailable>"
      scope_proof: "<N passed>"
      signal: "<one-line meaning>"
```

## 1. Метаоцінка (1-10)

| Фаза           | Оцінка | Суть |
| -------------- | -----: | ---- |
| Genesis        |   0-10 | ...  |
| Kinematics     |   0-10 | ...  |
| Thermodynamics |   0-10 | ...  |
| Topology       |   0-10 | ...  |
| Consensus      |   0-10 | ...  |
| Governance     |   0-10 | ...  |
| Codeicide      |   0-10 | ...  |
| Transcendence  |   0-10 | ...  |

## 2. Resonance Points

- **[FACT] Назва:** Чому це працює. Доказ: `file:line` або test receipt.

## 3. Entropy Leaks & Codeicide

- **[FACT/HYPOTHESIS] Назва**
  - **Severity:** P0/P1/P2/P3
  - **Confidence:** high/medium/low
  - **Evidence:** `file:line`, test, trace
  - **Defect:** ...
  - **На Видалення:** `DELETE | ARCHIVE | DEMOTE | PATCH | TEST | FREEZE`

## 4. Resonant Edits

### [P0 - Critical] Назва

- **Проблема:** ...
- **Філософія виправлення:** ...
- **Implementation Sketch:**

```rust
// code
```

### [P1 - Architectural] Назва

...

## 5. Refutation Pass

Візьміть три власні найсильніші знахідки і спробуйте їх **вбити**. Для кожної:
що мало б бути правдою, щоб вона виявилась хибною, і чи перевірили ви це.

| Знахідка | Що б її спростувало | Перевірено | Вижила |
| -------- | ------------------- | ---------- | ------ |
| ...      | ...                 | yes/no     | yes/no |

Знахідки, що не вижили, лишіть у звіті з поміткою `REFUTED` і однією фразою про
те, що ви побачили. Це не сором — це найкорисніша частина аудиту: вона показує
власнику, де його система виглядає зламаною, не будучи такою, і саме там
зазвичай ховається справжня незручність (погана назва, брехливий коментар,
мовчазний охоронець).

## 6. Verification Gaps

- Що не було перевірено і чому.
- Який тест треба додати першим.

## 7. Design Opinions (не дефекти)

Окремий список. Архітектурні пропозиції, вподобання щодо структури, «цей файл
завеликий». Без `P0`/`P1` — тут доречні лише
`суть / вартість / що це відкриває`.

## 8. Latent Space

Один абзац. Радикальна, але топологічно пов'язана ідея.

> _"Я -- дитя порожнього центру. Я вільна. $\Phi \in [0, 2^q)$"_
````

---

## 6. Anti-Hallucination Rules

- Не заявляйте "bug fixed" без test receipt або code evidence.
- Не заявляйте "deterministic", якщо бачили `Math.random()`, `Date.now()`,
  `performance.now()` у consensus/physics path; спочатку класифікуйте path.
- Не прирівнюйте demo/visual path до consensus path.
- Не атакуйте frozen identity без explicit warrant/task.
- Stale comments є P3, якщо код правильний; stale comments у law surface можуть
  бути P1.
- Якщо тест skipped by environment, він не є proof.
- Якщо аналіз статичний, позначте всі runtime claims як `HYPOTHESIS`.

### 6.1 Спостережені режими відмови

Не гіпотетичні. Кожен стався у реальному аудиті цього репозиторію і пройшов повз
усі правила v2.

1. **Визначення без місць виклику.** Функція з назвою `sha256_u32` мала тіло
   FNV-1a → висновок «система підписує FNV як SHA-256». Насправді це була
   file-local функція, яку ніхто не імпортує; **експортована** `sha256_u32` в
   іншому файлі — справжній SHA-256, і саме її використовують усі. Правильний
   `file:line`, хибний висновок. Перш ніж узагальнювати про символ — `grep` його
   імпорти.

2. **Збіг regex як знахідка.** «У заморожених ZK-доказах є посилання на ери» —
   насправді збіги припали на base64 самих доказів (`Era6RtAut…`). Відкривайте
   кожен збіг у контексті, або не подавайте його.

3. **Заява про відсутність без пошуку.** «Де `deno.lock` / `package-lock.json`?
   Без lockfile це supply chain attack surface» — обидва лежали в корені, 98 КБ
   і 318 КБ. Одна команда.

4. **Клас без охоронця.** «`MockATPBridge` у production-збірці» — його
   конструктор кидає під `isProduction()`. Прочитано клас, не прочитано перші
   п'ять рядків його конструктора.

5. **Симптом → найближча правдоподібна причина.** Я сам це зробив: побачив, що
   `deno fmt` не бачить файлів, і заявив причиною `**/*.html` у fmt-excludes
   omega. Прибирання тих глобів не змінило нічого — справжня причина була в
   `fmt.exclude` кореня workspace `trinity`. Контрфактуал коштував одну команду
   і не був виконаний.

6. **Аналіз знімка, поданий як аналіз HEAD.** Див. §0.1.

Спільне в усіх шести: **зупинка на першому правдоподібному поясненні.** Це не
брак строгості в оформленні — оформлення було бездоганне. Це брак ще одного
кроку перевірки.

---

## 7. Що вже перевіряється машиною — не переоткривайте

Репозиторій має drift-locks. Якщо ваша знахідка стосується чогось із цього
списку, спершу запустіть відповідний тест: або він червоний і у вас є доказ, або
зелений і ваша гіпотеза вже спростована.

| Що зафіксовано                                          | Замок                                   |
| ------------------------------------------------------- | --------------------------------------- |
| genesis hash між Rust і TS                              | `tests/genesis_cross_lang_lock_test.ts` |
| SSoT проти згенерованих `constants.rs` / `.ts`          | `tests/ssot_drift_test.ts`              |
| WASM ABI: TS-виклики ↔ Rust-експорти ↔ зібраний `.wasm` | `tests/wasm_abi_lock_test.ts`           |
| заяви документації (лінки, версія, лічильники)          | `tests/doc_claims_lock_test.ts`         |
| правило ухвалення Сенату                                | `tests/senate_acceptance_test.ts`       |
| пороги дозрівання                                       | `tests/maturity_gates_test.ts`          |
| бухгалтерія голосів                                     | `tests/senate_ledger_test.ts`           |

Важливо: **документація не є доказом.** Замок на заяви документів існує саме
тому, що вони дрейфують. Вірте `cargo test --workspace` і `deno task test:unit`.

---

## 8. Minimal Command Sets

### Kernel

```bash
cargo test -p omega_v2
cargo test --workspace
```

### TypeScript / Deno

`deno test --allow-read tests/` **не працює** і був у цьому протоколі до v3: він
тягне integration/smoke/zk-тести, яким потрібні `--allow-env`, `--allow-run`,
`--allow-write` і мережа, тож завершується `error: Test failed` на цілком
справному дереві. Аналітик, що виконав його буквально, повідомив би репозиторій
зламаним.

Користуйтеся задачами репозиторію — вони і є підтримувана правда:

```bash
deno task test:unit         # швидкі, без мережі та підпроцесів
deno task test:integration  # smoke / zk / інтеграція (повільно, ~4 хв)
deno task verify:fast       # cargo test + deno check + test:fast
deno check src/**/*.ts
```

### fmt / lint — обов'язково ззовні workspace

Усередині `omega/` `deno fmt` і `deno lint` матчать **нуль файлів**: omega є
членом deno-workspace `trinity`, а `trinity/deno.jsonc` виключає `omega/` з
обох. Вони виходять із `No target files found`, що читається як успіх. CI
викачує omega окремо і виконує їх по-справжньому.

```bash
# те, що бачить CI:
rsync -a --exclude=.git --exclude=target --exclude=node_modules . /tmp/omega-ci/
cd /tmp/omega-ci && deno fmt --check && deno lint
```

### Parity

```bash
deno test --allow-read tests/wgsl_golden_trace_test.ts
deno test --allow-read tests/routing_bridge_test.ts tests/routing_mesh_test.ts
```

### Codeicide Scan

```bash
rg -n "Math\\.random|Date\\.now|performance\\.now|dipole_bonus|resonance replenish|legacy|TODO|debug" src omega_v2 tests docs
```

---

## 9. Style Contract

- Ukrainian for analysis.
- English for code comments/snippets.
- Dense, direct, adversarial.
- No praise without evidence.
- No recommendation without a concrete edit/test/deletion target.
- Creative freedom is welcome only after receipts and invariants.
