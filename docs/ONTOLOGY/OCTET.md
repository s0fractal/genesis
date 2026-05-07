---
protocol: OMEGA-64_OCTET_FORMAT
version: 0.1.0
status: experimental
language: Ukrainian
code_language: English
updated_at_utc: 2026-05-06T23:15:55Z
updated_by: Codex verifier/operator/oracle
target_repo: /Users/s0fractal/Genesis
target_commit: 32bdaf6
companion_protocols:
  - docs/ONTOLOGY/OCTET_MAP.md
  - docs/HOW-TO/IDEA_LIFECYCLE.md
  - docs/HOW-TO/ACT.md
---

# OMEGA-64: Octet Semantic Primitive

> **Мета:** описати мінімальний фрактальний контейнер сенсу: 8 фіксованих
> позицій, де кожна позиція може містити значення або ще один octet.

Це не frozen law і не новий build system. Це експериментальний semantic overlay,
який дозволяє агентам, людям і майбутньому liquid-шару передавати контекст
коротко, але з можливістю розгортання вглиб.

---

## 0. Primitive

```ts
type Octet = [
  OctetValue,
  OctetValue,
  OctetValue,
  OctetValue,
  OctetValue,
  OctetValue,
  OctetValue,
  OctetValue,
];

type OctetValue =
  | null
  | string
  | number
  | boolean
  | HashRef
  | PathRef
  | FoldedRef
  | Octet;
```

Кожен octet має рівно 8 слотів. Порожній слот означає `unknown`, `irrelevant`
або `not unfolded yet`, а не математичний нуль.

---

## 1. Slot Semantics

| Slot | Name      | Фаза     | Що означає                                  |
| ---- | --------- | -------- | ------------------------------------------- |
| `0`  | Identity  | Seed     | ім'я, root hash, закон, сутність            |
| `1`  | Field     | Context  | середовище, субстрат, батьківська область   |
| `2`  | Tension   | Need     | напруга, дефіцит, питання, причина руху     |
| `3`  | Vector    | Action   | дія, перехід, мутація, алгоритм             |
| `4`  | Body      | Artifact | код, файл, стан, форма, матеріалізація      |
| `5`  | Witness   | Proof    | тест, receipt, доказ, trace, oracle witness |
| `6`  | Ledger    | Memory   | історія, quorum, ownership, archive, chain  |
| `7`  | Resonance | Next     | енергія, future vector, fork, розгортання   |

Головний інваріант:

```text
meaning(value) = token/value + slot + ancestry
```

Один і той самий символ у різних слотах має різну роль. `LAW_HASH` у слоті `0` є
ідентичністю, у слоті `5` є доказом, у слоті `6` є записом пам'яті.

---

## 2. Recursive Rule

Та сама вісімка повторюється на кожній глибині.

```text
oct:1       Physics / substrate
oct:1.0     Identity of physics
oct:1.3     Action inside physics
oct:1.5     Witnesses/proofs inside physics
oct:1.5.6   Ledger of physics witnesses
```

Це дозволяє читати адресу без повного відкриття вузла. Модель, яка бачить
`oct:1.5`, вже знає: це не просто "тести", а proof/witness-сектор фізики.

---

## 3. Folded References

Розгорнутий octet може бути замінений компактним folded reference.

```yaml
folded_ref:
  hash: "sha256:<content-or-canonical-octet-hash>"
  address: "oct:1.5"
  phase: 5
  angle_deg: 73.125
  energy: 0.82
  kind: "witness"
  summary: "Rust/WGSL physics parity receipt"
```

Фолдінг має зберігати достатньо shallow-context, щоб агент міг орієнтуватися без
обов'язкового відкриття всього дерева.

---

## 4. Canonical Shape

Поки формат експериментальний, canonical binary encoding не вводиться. Для
людських документів використовуйте YAML/Markdown, для sparse index - NDJSON.

Рекомендована форма запису:

```yaml
octet:
  address: "oct:6.7"
  phase: 7
  angle_deg: 309.375
  energy: 0.68
  values:
    0: "Radicle Idea Mesh"
    1: "Genesis external governance"
    2: "early consensus needs cheap substrate"
    3: "route ideas through SPORE/SEED debate"
    4: "tasks/0236.md"
    5: "pending receipts"
    6: "radicle discussion"
    7: "proposal mesh"
```

Для машинного індексу використовується `tasks/octet-index.ndjson`.

---

## 5. Safety Boundary

Octet-layer не має права змінювати фізичну істину Genesis.

- Він не замінює Rust/WGSL/TS/ZK тести.
- Він не змінює frozen invariants.
- Він не робить директорії або submodules обов'язковими.
- Він не є доказом без witness у слоті `5`.
- Він може вказати на law, але не може сам стати law без окремого warrant.

Практичне правило:

```text
Semantic overlay can guide attention.
Executable receipts decide truth.
Frozen law requires warrant.
```

---

## 6. Use By Agents

Коли агент читає задачу, файл або proposal, він може швидко згорнути його в
octet:

1. `0`: що це?
2. `1`: де воно живе?
3. `2`: яку напругу воно несе?
4. `3`: яку дію пропонує?
5. `4`: який artifact змінює або створює?
6. `5`: чим доведено?
7. `6`: де пам'ять/ledger?
8. `7`: куди це розгортається?

Це робить "роздуми над фізикою" семантичним відображенням самої фізики: ті самі
позиції, фази, енергії і folding/unfolding застосовуються до коду, задач,
доказів і майбутніх proposal-ів.
