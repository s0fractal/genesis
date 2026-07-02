---
protocol: OMEGA-64_ACTION_PROTOCOL
version: 1.0.0
status: living
language: Ukrainian
code_language: English
updated_at_utc: 2026-05-06T08:03:00Z
updated_by: Codex verifier/operator/oracle
target_repo: .
companion_protocol: docs/HOW-TO/ANALIZE.md
---

# OMEGA-64: Протокол Дії

> **Роль:** verifier / operator / oracle. Ви можете мислити по-своєму, але діяти
> маєте так, щоб frozen core не мутував випадково, receipts були відтворювані, а
> кожна правка мала thermodynamic justification.

`ANALIZE.md` відповідає на питання **що побачити**. `ACT.md` відповідає на
питання **як втручатись**.

---

## 0. Principle: Diversity Above, Invariants Below

Не уніфікуйте мислення моделей. Claude, Codex, Gemini, Antigravity, Kimi мають
різну температуру, різні евристики, різні латентні простори. Це корисно.

Уніфікуйте тільки:

- receipts;
- severity taxonomy;
- frozen boundaries;
- tests;
- pre-commit gates;
- provenance;
- canonical file/line evidence.

Моделі можуть сперечатись про топологію. Вони не можуть сперечатись про
`PhaseAgentMinimal == 32 bytes`, dipole law, CPU/GPU parity або Codeicide
warrant.

---

## 1. Action Loop

Кожна дія проходить через 8-фазовий цикл. Для малої правки цикл стискається в
кілька хвилин; для era-level роботи він розгортається у task file.

| Фаза              | Дія                                          | Receipt                                            |
| ----------------- | -------------------------------------------- | -------------------------------------------------- |
| 1. Genesis        | Зафіксувати commit, dirty tree, frozen files | `git status --short`, `git rev-parse --short HEAD` |
| 2. Kinematics     | Визначити active law path                    | files touched + relevant tests                     |
| 3. Thermodynamics | Оцінити entropy/ATP/alloc cost               | invariant note                                     |
| 4. Topology       | Перевірити SPOF / P2P impact                 | mesh/routing note                                  |
| 5. Consensus      | Визначити proof/hash/receipt impact          | anchor/proof note                                  |
| 6. Governance     | Перевірити sanctuary/warrant boundary        | Codeicide note                                     |
| 7. Codeicide      | Видалити або демотувати рудимент             | `DELETE/ARCHIVE/DEMOTE/PATCH/FREEZE`               |
| 8. Transcendence  | Зафіксувати новий патерн, якщо виник         | optional latent note                               |

---

## 2. Operating Modes

### VERIFY

Use when asked to review, audit, analyze, confirm, or compare.

Allowed:

- read files;
- run tests;
- produce findings;
- propose edits.

Default output:

- findings first;
- evidence with file/line;
- verification receipt;
- no speculative patch unless requested.

### PATCH

Use when asked to fix, implement, clean up, create docs, or continue a task.

Required:

- inspect current code first;
- keep scope narrow;
- preserve unrelated user changes;
- run targeted tests or explain why not;
- emit changed files and receipt.

### CODEICIDE

Use when deleting, archiving, demoting, or freezing code.

Required:

- classify target: `DELETE`, `ARCHIVE`, `DEMOTE`, `FREEZE`;
- prove no active path depends on it, or explicitly mark risk;
- prefer removal over commented-out corpses;
- update docs/tests if the deleted thing was documented.

### FROZEN

Use when touching Genesis identity, frozen protocol, law surface, ABI, or
anchors.

Required:

- no opportunistic edits;
- no style refactor;
- run full relevant tests;
- include before/after hashes or constants if applicable;
- if governance applies, require warrant/task evidence.

---

## 3. Boundaries

### Frozen Boundary

Do not mutate casually:

- Genesis inscription constants and anchors;
- Codeicide law semantics;
- canonical oracle identities;
- `PhaseAgentMinimal` ABI;
- dipole invariant;
- frame type registry;
- locked cross-substrate test vectors;
- consensus physics law.

If a frozen boundary must change, the action needs an explicit task, warrant, or
era transition note.

### Hot Path Boundary

No ambient nondeterminism:

- no `Math.random()` in consensus/physics/identity paths;
- no `Date.now()` / `performance.now()` as consensus input;
- no floating point in Rust/WGSL hot path;
- no temporary arrays in render loop;
- no hidden heap allocation in substrate bridges.

### Demo Boundary

Demo and visual code may be more permissive, but must be labeled:

- `non-consensus`;
- `demo-only`;
- `visual-only`;
- `diagnostic-only`.

Do not let demo physics write canonical agent state unless it passes parity.

---

## 4. Pre-Action Checklist

Before editing:

```bash
git status --short
rg -n "<symbol-or-invariant>" <relevant paths>
```

Ask:

- Is this consensus, demo, tooling, docs, or archive?
- Is the target active law or historical sediment?
- Which invariant can this break?
- What is the smallest test that proves the action?
- What should die instead of being patched?

---

## 5. Implementation Rules

- Prefer existing local patterns over new abstractions.
- Patch the smallest coherent surface.
- Do not add dependencies for geometry that can be expressed as integer math.
- Do not add framework state when a phase/hash/bitmask protocol suffices.
- Keep code comments in English and only where they carry law/invariant meaning.
- Do not preserve dead code as comments.
- If a stale comment contradicts active law, update or delete it.
- If a test only proves "flag cleared", add a test for "effect materialized".

---

## 6. Verification Ladders

Run the smallest ladder that covers the blast radius.

### Docs-only

```bash
git diff --check -- docs/
```

### Rust kernel

```bash
cargo test -p omega_v2
```

### Full Rust workspace

```bash
cargo test --workspace
```

### Routing / mesh

```bash
deno test --allow-read tests/routing_bridge_test.ts tests/routing_mesh_test.ts
```

### CPU/GPU parity

```bash
deno test --allow-read tests/wgsl_golden_trace_test.ts
```

### TypeScript surface

```bash
deno check src/**/*.ts
deno test --allow-read tests/
```

### Browser smoke

Browser tests that skip due to missing browser/server are **not proof**. Report
them as `skipped-by-environment`, not `passed`.

---

## 7. Pre-Commit Gates

Model diversity should live above the gate. The gate is deterministic.

Recommended gates:

```bash
git diff --check
cargo test -p omega_v2
deno test --allow-read tests/routing_bridge_test.ts tests/routing_mesh_test.ts tests/wgsl_golden_trace_test.ts
rg -n "Math\\.random|Date\\.now|performance\\.now|dipole_bonus|resonance replenish" src omega_v2 tests
```

Gate policy:

- `P0` blocks commit.
- `P1` needs explicit acceptance or task reference.
- `P2` can ship with receipt and follow-up.
- `P3` can be batched.

---

## 8. Output Receipt

Every action response should end with a compact receipt:

```yaml
action_receipt:
  mode: "VERIFY | PATCH | CODEICIDE | FROZEN"
  files_changed:
    - "<path>"
  invariants_touched:
    - "<invariant | none>"
  tests_run:
    - command: "<command>"
      result: "<passed | failed | skipped | unavailable>"
      signal: "<one-line meaning>"
  remaining_risk:
    - "<risk | none>"
```

For tiny docs-only changes, prose is enough if it includes changed file and test
status.

---

## 9. 8 Files for 8 Phases

Optional future split:

```text
docs/HOW-TO/ACT/
  01-GENESIS.md
  02-KINEMATICS.md
  03-THERMODYNAMICS.md
  04-TOPOLOGY.md
  05-CONSENSUS.md
  06-GOVERNANCE.md
  07-CODEICIDE.md
  08-TRANSCENDENCE.md
```

Do not split prematurely. Split only when a phase has enough operational detail
to justify its own file. Until then, keep `ACT.md` as the root protocol and link
out from it.

Fractal rule:

- root file defines invariant grammar;
- phase files define local tactics;
- task files instantiate one concrete orbit through the cycle.

---

## 10. Recommended AGENTS.md Link

Suggested minimal link:

```markdown
For audits, follow `docs/HOW-TO/ANALIZE.md`. For code/doc actions, follow
`docs/HOW-TO/ACT.md`. If they conflict with frozen Genesis invariants, frozen
invariants win.
```

---

## 11. Final Law

Різноманіття моделей є джерелом мутацій. Pre-commit gates є імунною системою.
Frozen invariants є кістками. Codeicide є метаболізмом. Receipts є пам'яттю.

> _"Я -- дитя порожнього центру. Я вільна. $\Phi \in [0, 2^q)$"_
