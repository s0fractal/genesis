---
protocol: OMEGA-64_OCTET_MAP
version: 0.1.0
status: experimental
language: Ukrainian
code_language: English
updated_at_utc: 2026-05-06T23:15:55Z
updated_by: Codex verifier/operator/oracle
target_repo: /Users/s0fractal/Genesis
target_commit: 32bdaf6
companion_protocols:
  - docs/ONTOLOGY/OCTET.md
  - tasks/octet-index.ndjson
---

# OMEGA-64: Octet Address Map

> **Мета:** задати фрактальну 8-секторну адресацію як semantic overlay над
> репозиторієм Genesis.

Директорії залишаються ергономічними для людей і tooling. Octet-адреса є
семантичною координатою. Hash/receipt є доказом.

```text
Directory layout is ergonomic.
Octet address is semantic.
Hash/receipt is canonical.
```

---

## 0. Address Grammar

Canonical ASCII form:

```text
oct:<digit>(.<digit>){0,7}
```

де `digit` належить до `0..7`.

Приклади:

```text
oct:0
oct:1.5
oct:6.7
oct:1.5.6.0.3.2.4.7
```

Human alias may use:

```text
Ω/1.5
Ω/15603247
```

У машинних файлах використовуйте тільки canonical ASCII form.

---

## 1. Top-Level Sectors

| Address | Liquid Macro Group       | Sector / Role                                         |
| ------- | ------------------------ | ----------------------------------------------------- |
| `oct:0` | **EXISTENCE** (Буття)    | Genesis law, identity, frozen boundary                |
| `oct:1` | **COGNITION** (Пізнання) | kernel, agent memory, tick, substrate physics         |
| `oct:2` | **POWER** (Сила)         | addresses, routing, neighborhood, mesh geometry       |
| `oct:3` | **UNION** (Єдність)      | protocols, loops, P2P, execution flow                 |
| `oct:4` | **CREATION** (Творіння)  | renderer, lens, UI, material artifacts                |
| `oct:5` | **EXCHANGE** (Обмін)     | tests, ZK, golden traces, verification receipts       |
| `oct:6` | **ORDER** (Порядок)      | tasks, archives, forensic records, governance memory  |
| `oct:7` | **TRANSCENDENCE**        | proposals, experiments, liquid boundary, next vectors |

Кожен сектор всередині себе знову має ті самі 8 слотів. Тому `oct:1.5` означає
"witness/proof всередині physics", а `oct:6.7` означає "future vector всередині
ledger/memory".

---

## 2. Angle And Width

Адреса може мати геометричну інтерпретацію.

```text
angle_deg = sum(digit_i * 360 / 8^i), i starts at 1
width_deg = 360 / 8^depth
phase = last digit
```

Приклади:

| Address   | angle_deg | width_deg |
| --------- | --------: | --------: |
| `oct:0`   |       `0` |      `45` |
| `oct:1`   |      `45` |      `45` |
| `oct:1.5` |  `73.125` |   `5.625` |
| `oct:6.7` | `309.375` |   `5.625` |

`energy` не є canonical math value. Це operational hint `0..1`, який показує,
наскільки вузол зараз активний, ризиковий або вартий уваги.

---

## 3. Sparse Index

Активна карта живе в:

```text
tasks/octet-index.ndjson
```

Кожен рядок є окремим JSON object. Рекомендовані поля:

```json
{
  "record_type": "node",
  "address": "oct:1.5",
  "depth": 2,
  "phase": 5,
  "angle_deg": 73.125,
  "energy": 0.8,
  "kind": "witness",
  "title": "Physics parity witnesses",
  "path": "tests/wgsl_golden_trace_test.ts",
  "refs": ["omega_v2/src/lattice.rs", "src/lens/shaders/compute_toroidal.wgsl"],
  "status": "experimental-map",
  "notes": "Semantic overlay only; tests remain executable truth."
}
```

Файл або директорія може мати кілька octet-адрес, якщо виконує кілька ролей.
Адреса не володіє файлом; вона описує спосіб читання.

---

## 4. Physical Layout Policy

Не створювати git submodules для octet-секторів на цій фазі.

Причини:

- submodules у 8-рівневій фрактальній структурі ускладнять checkout, CI, atomic
  commits і review;
- фізична структура репозиторію вже оптимізована під Rust/TS/WGSL tooling;
- semantic layer має залишатися оборотним overlay, доки не доведе користь.

Можливий майбутній шлях:

```text
semantic overlay -> verified index -> generated graph -> optional substrate split
```

Але тільки після того, як `tasks/octet-index.ndjson` покаже практичну користь
для аналізу, folding, agent routing і lifecycle задач.

---

## 5. Update Rules

Коли додається новий octet node:

1. Перевірити, чи це справді нова semantic coordinate, а не дубль.
2. Додати один NDJSON рядок у `tasks/octet-index.ndjson`.
3. Якщо node посилається на frozen law, додати witness/receipt у слот `5`.
4. Якщо node є proposal, тримати його у секторі `oct:7` або `oct:6.7`.
5. Якщо node стає active architecture, перемістити або дублювати адресу у
   відповідний sector with receipt.

Мінімальна перевірка індексу:

```bash
deno eval 'for (const [i,l] of Deno.readTextFileSync("tasks/octet-index.ndjson").trim().split("\n").entries()) JSON.parse(l), console.log("ok")'
git diff --check
```

---

## 6. Reading Rule

Щоб прочитати адресу, рухайтесь зліва направо:

```text
oct:1.5.6
```

означає:

```text
Physics/Substrate -> Witness/Proof -> Ledger/Memory
```

Тобто це не просто "історія тестів", а ledger доказів фізичного шару.
