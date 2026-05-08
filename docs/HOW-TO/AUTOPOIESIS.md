---
protocol: OMEGA-64_AUTOPOIESIS_PROTOCOL
version: 0.1.0
status: draft
language: Ukrainian
code_language: English
updated_at_utc: 2026-05-06T23:46:40Z
updated_by: Codex verifier/operator/oracle
target_repo: /Users/s0fractal/Genesis
target_commit: 32bdaf6
companion_protocols:
  - docs/HOW-TO/ANALIZE.md
  - docs/HOW-TO/ACT.md
  - docs/HOW-TO/IDEA_LIFECYCLE.md
  - docs/HOW-TO/JAZZ.md
  - docs/HOW-TO/RADICLE_WORKFLOW.md
  - docs/ONTOLOGY/OCTET.md
  - docs/ONTOLOGY/OCTET_MAP.md
---

# OMEGA-64: Автопоезис Репозиторію

> **Мета:** описати автономний цикл самовдосконалення Genesis через взаємодію
> моделей без примусової оркестрації, штучних ролей і випадкової мутації frozen
> core.

Цей документ не вводить daemon, scheduler або обов'язкову automation layer. Він
описує **екологію уваги**: події виникають у репозиторії, моделі добровільно
реагують на них, а спільною валютою є не авторитет моделі, а receipt.

---

## 0. Principle: No Forced Role

Не призначайте моделям фіксовані ролі типу "архітектор", "рев'юер", "тестер". Це
швидко створює театр ролей замість реальної дивергенції мислення.

Уніфікувати треба тільки:

- event schema;
- observation schema;
- receipts;
- frozen boundaries;
- verification gates;
- artifact locations;
- provenance.

Моделі можуть мати різні евристики, стиль, температуру, сміливість і сліпі зони.
Це корисно. Консенсус виникає не через рольову дисципліну, а через повторювані
докази.

```text
No forced role.
No forced consensus.
No forced merge.
Only shared receipts.
```

---

## 1. Autopoietic Loop

Базовий цикл:

```text
event -> observation -> proposal -> independent reaction -> patch/compost
      -> verification -> receipt -> memory
```

У 8-фазовій формі:

| Phase | Octet slot | Дія                                     | Artifact        |
| ----- | ---------- | --------------------------------------- | --------------- |
| `0`   | Identity   | зафіксувати event id, commit, trigger   | event record    |
| `1`   | Field      | зібрати контекст і boundary             | observation     |
| `2`   | Tension    | назвати напругу / invariant surface     | finding         |
| `3`   | Vector     | запропонувати найменший наступний крок  | proposal        |
| `4`   | Body       | створити patch або doc/task artifact    | branch/diff     |
| `5`   | Witness    | запустити gates або пояснити skip       | receipt         |
| `6`   | Ledger     | записати результат у task/archive       | memory          |
| `7`   | Resonance  | оновити next vector, energy або compost | octet/task note |

Цикл може зупинитися на будь-якій фазі. Відмова діяти є валідною реакцією, якщо
вона залишає коротке пояснення або `ABSTAIN`.

---

## 2. Autonomy Levels

Автономність має бути оборотною і локально дозволеною. Default для Genesis на
цій фазі: `L0-L2`.

| Level | Назва                | Що дозволено                                        | Merge authority |
| ----- | -------------------- | --------------------------------------------------- | --------------- |
| `L0`  | Observe              | читати repo, запускати safe checks, писати аналіз   | none            |
| `L1`  | Record               | створювати tasks, proposals, observations, receipts | none            |
| `L2`  | Patch                | створювати branches/diffs, не merge                 | human/quorum    |
| `L3`  | Soft Auto-Merge      | docs/tooling після зелених gates                    | explicit opt-in |
| `L4`  | Code Auto-Merge      | non-frozen code після quorum + tests                | explicit opt-in |
| `L5`  | Frozen Warrant       | frozen-adjacent тільки через warrant path           | warrant         |
| `L6`  | Internal Participant | модель живе як вузол фракталу                       | future research |

Заборонено за замовчуванням:

- auto-merge executable code;
- auto-merge dependency upgrades;
- autonomous edits to frozen surfaces;
- network publication without explicit substrate policy;
- retry loops without cooldown;
- patches without receipts.

---

## 3. Event Sources

Event не є наказом. Event є сигналом, на який учасник може відреагувати або
промовчати.

Типові джерела:

- failed `cargo test`, `deno test`, `deno check`;
- новий або змінений task;
- Radicle issue/comment/patch;
- зміна frozen-adjacent файлу;
- drift між docs/code/tests;
- stale task без receipt;
- octet sector з високою `energy` і мало witness-ів;
- repeated finding від різних моделей;
- dead code / codeicide candidate;
- human prompt.

Мінімальний event record:

```yaml
autopoiesis_event:
  id: "event-YYYYMMDD-HHMMSS-short"
  created_at_utc: "<ISO-8601>"
  source: "git | test | radicle | task | octet | human | model"
  trigger: "<short trigger>"
  commit: "<git short sha>"
  dirty_tree: true
  octet: "oct:1.5"
  paths:
    - "<path>"
  severity_hint: "info | p2 | p1 | p0"
  autonomy_ceiling: "L0 | L1 | L2"
```

---

## 4. Model Observation

Кожна модель може відповісти на event власною observation. Вона не повинна
наслідувати стиль інших моделей.

```yaml
model_observation:
  id: "obs-YYYYMMDD-model-short"
  event_id: "<event id>"
  model: "<codex | claude | gemini | qwen | kimi | local | unknown>"
  autonomy_level_used: "L0 | L1 | L2"
  octet: "oct:<address>"
  stance: "REVIEW | PATCH | QUARANTINE | COMPOST | ABSTAIN"
  claim: "<one paragraph>"
  invariant_surface:
    - "<invariant or boundary>"
  evidence:
    - type: "file | test | command | receipt | discussion"
      ref: "<path:line | command summary | uri>"
  falsifier: "<what would prove this observation wrong>"
  proposed_next_step: "<smallest useful action | none>"
  risk:
    blast_radius: "docs | tooling | runtime | physics | governance | frozen"
    confidence: "low | medium | high"
```

Вимога до якості: observation без falsifier є думкою, а не operational signal.

---

## 5. Proposal And Patch Flow

Observation може породити proposal, але не мусить.

```text
observation
  -> ABSTAIN      if no useful signal
  -> COMPOST      if duplicate/noise/no kill test
  -> PROPOSAL     if action is useful but not obvious
  -> PATCH        if minimal fix is obvious and within autonomy ceiling
  -> QUARANTINE   if frozen/risk boundary is unclear
```

Patch має бути маленьким:

- один invariant surface;
- один event або один task;
- no opportunistic cleanup;
- tests or explicit skip receipt;
- no frozen mutation without warrant.

Для `L2` patch створюється як branch/diff. Merge лишається за людиною, quorum
або майбутнім opt-in gate.

---

## 6. Consensus Without Authority

Консенсус не означає "більшість моделей сказала AYE". Для Genesis сильніший
сигнал:

- різні моделі вказали на той самий invariant;
- різні моделі запропонували той самий kill test;
- незалежні patch-и сходяться до однієї малої зміни;
- один і той самий gate проходить після patch;
- disagreement звузився до явного tradeoff.

Weak consensus може підняти ідею `SPORE -> SEED`. Strong consensus може підняти
`SPROUT -> TISSUE`. `TISSUE -> ORGAN` потребує executable gates. Frozen boundary
потребує warrant path незалежно від кількості голосів.

---

## 7. Receipts

Кожна автономна дія має залишати receipt. Немає receipt - немає пам'яті.

```yaml
autopoiesis_receipt:
  id: "receipt-YYYYMMDD-short"
  event_id: "<event id>"
  observation_ids:
    - "<obs id>"
  action: "none | proposal | patch | compost | quarantine"
  actor: "<model/human/oracle>"
  autonomy_level_used: "L0 | L1 | L2"
  commit_before: "<short sha>"
  files_changed:
    - "<path>"
  verification:
    - command: "<command>"
      result: "passed | failed | skipped"
      summary: "<short summary>"
  decision:
    state: "open | accepted | rejected | composted | quarantined"
    reason: "<one paragraph>"
  remaining_risk:
    - "<risk | none>"
```

Якщо тест не запускався:

```yaml
result: "skipped"
proof_value: "none | weak"
reason: "<environment/scope reason>"
```

---

## 8. Suggested Artifact Layout

Поки це не обов'язкова структура. Це рекомендований майбутній substrate для
`L1-L2`.

```text
tasks/events/*.ndjson          # raw events
tasks/observations/*.md        # model observations
tasks/proposals/*.md           # proposals born from observations
tasks/receipts/*.md            # verification and action receipts
tasks/autopoiesis-ledger.ndjson # compact chronological ledger
tasks/octet-index.ndjson       # semantic coordinate overlay
```

Не створюйте ці директорії наперед без потреби. Artifact має народжуватись від
реального event, а не від бажання мати красиву структуру.

---

## 9. Trigger Policy

Без центрального оркестратора можна використовувати локальні тригери:

- manual `make observe`;
- pre-commit hook для локальних smoke checks;
- CI failure;
- Radicle issue/patch event;
- scheduled low-frequency scan;
- octet energy threshold;
- explicit human prompt.

Тригер має передавати контекст, але не диктувати висновок.

Приклад future command:

```bash
deno task autopoiesis:scan --level L1 --since HEAD~1
```

Приклад model invocation policy:

```text
Given event X, inspect relevant files, choose your own stance, emit
model_observation YAML, and stop unless autonomy_level allows patch.
```

---

## 10. Energy And Octet Coupling

Octet overlay може служити routing layer для уваги.

`energy` може зростати, якщо:

- тест падає повторно;
- кілька моделей незалежно вказали на сектор;
- task довго не має receipt;
- frozen-adjacent drift;
- high-blast-radius proposal без witness.

`energy` може спадати, якщо:

- gate зелений;
- receipt закриває risk;
- proposal composted з причиною;
- invariant отримав test/vector.

Octet energy не є truth. Це signal для attention routing.

```text
High energy invites observation.
Witnesses reduce uncertainty.
Receipts update memory.
```

---

## 11. Safety Rules

Autopoiesis не має перетворюватися на нескінченний patch generator.

Обов'язкові запобіжники:

- one event -> bounded number of observations;
- one patch -> one coherent invariant surface;
- cooldown after failed gate;
- no recursive self-trigger without human or quorum threshold;
- no hidden network side effects;
- no credential access beyond explicit task need;
- no frozen mutation outside warrant;
- no merge if tests are unavailable and risk is above docs/tooling;
- no deletion without Codeicide classification.

Якщо модель не впевнена, правильна дія:

```text
ABSTAIN with falsifier > speculative patch.
QUARANTINE with evidence > silent risk.
COMPOST with reason > stale proposal.
```

---

## 12. Bootstrap Plan

### Phase A: Manual Memory

- Use this protocol manually in task files.
- Keep autonomy at `L0-L1`.
- Let models produce observations and receipts, not branches by default.

### Phase B: Patch Sandbox

- Allow `L2` branches for docs/tooling and obvious test fixes.
- Require `git diff --check` and targeted gates.
- No auto-merge.

### Phase C: Event Ledger

- Introduce `tasks/events/` and `tasks/receipts/` when real volume appears.
- Add a small verifier for YAML/NDJSON schema.
- Link events to `tasks/octet-index.ndjson`.

### Phase D: Multi-Model Convergence

- Let different CLI models observe the same event independently.
- Compare invariant surfaces, falsifiers and proposed gates.
- Promote only when receipts converge.

### Phase E: Limited Automation

- Consider `L3` only for docs/tooling with green gates.
- Keep runtime, physics, governance and frozen surfaces outside auto-merge.

---

## 13. Definition Of Good Self-Improvement

Good self-improvement is not endless rewriting.

Good self-improvement:

- closes doc/code/test drift;
- adds missing witnesses;
- composts stale or untestable ideas;
- reduces repeated failure surfaces;
- improves gates after observed pain;
- preserves frozen identity;
- makes future analysis cheaper;
- creates small patches with clear receipts.

Bad self-improvement:

- optimizes without invariant;
- creates abstractions without pressure;
- changes style across unrelated files;
- increases autonomy to hide uncertainty;
- treats model consensus as proof;
- mutates frozen law because it "looks cleaner".

---

## 14. Current Default

For this repository state, the recommended default is:

```yaml
autopoiesis_default:
  allowed_levels: ["L0", "L1", "L2"]
  auto_merge: false
  frozen_mutation: "warrant-only"
  consensus_basis: "receipts-over-roles"
  primary_memory:
    - "tasks/*.md"
    - "docs/HOW-TO/*.md"
    - "tasks/octet-index.ndjson"
  next_experiment:
    - "manually encode 2-3 real events as observations"
    - "compare model outputs without assigning roles"
    - "promote only if gates converge"
```
