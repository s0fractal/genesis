---
protocol: OMEGA-64_IDEA_LIFECYCLE
version: 0.1.0
status: draft
language: Ukrainian
code_language: English
updated_at_utc: 2026-05-06T08:15:00Z
updated_by: Codex verifier/operator/oracle
target_repo: /Users/s0fractal/trinity/omega
companion_protocols:
  - docs/HOW-TO/ANALIZE.md
  - docs/HOW-TO/ACT.md
---

# OMEGA-64: Життєвий Цикл Ідей

> **Мета:** організувати зовнішню роботу над репозиторієм за тими самими
> фрактальними принципами, що й внутрішня OMEGA: фази, епіцикли, заміри,
> receipts, consensus, Codeicide і compost.

Цей файл описує не "менеджмент задач", а **онтологію ідей**. Ідея проходить шлях
від сирої мутації до active law або compost. Radicle/GitHub/local tasks є лише
субстратами, не центром.

---

## 0. Principle: Attention Before Law

Ранній консенсус не вирішує, що є істиною.

Ранній консенсус вирішує:

- чи ідея варта compute;
- який інваріант вона зачіпає;
- який тест може її вбити;
- чи потрібен warrant;
- чи це patch, RFC, experiment або compost.

Final law виникає тільки після implementation + verification + receipt.

---

## 1. Ontological States

| State        | Образ       | Значення                                | Наступний крок           |
| ------------ | ----------- | --------------------------------------- | ------------------------ |
| `SPORE`      | спора       | Сира ідея без proof і owner             | записати intent          |
| `SEED`       | зерно       | Ідея має короткий proposal і scope      | знайти invariant surface |
| `SPROUT`     | паросток    | Є implementation sketch або RFC outline | отримати review          |
| `TISSUE`     | тканина     | Є patch/test/receipt, але не ratified   | перевірити gates         |
| `ORGAN`      | орган       | Прийнято в active architecture          | підтримувати tests       |
| `ANCIENT`    | древній шар | Frozen invariant / law / anchor         | змінювати тільки warrant |
| `COMPOST`    | компост     | Відхилено, але збережено як nutrient    | індексувати причину      |
| `QUARANTINE` | ізоляція    | Ідея небезпечна або неперевірна         | вимагати доказ або kill  |

---

## 2. State Transitions

```text
SPORE
  -> SEED        if intent is written
  -> COMPOST     if duplicate/noise/no owner

SEED
  -> SPROUT      if invariant surface is identified
  -> QUARANTINE  if touches frozen law without warrant path
  -> COMPOST     if no test can kill it

SPROUT
  -> TISSUE      if patch/RFC/test sketch exists
  -> COMPOST     if implementation cost exceeds value

TISSUE
  -> ORGAN       if gates pass and quorum accepts
  -> QUARANTINE  if evidence conflicts
  -> COMPOST     if gates fail and no repair path

ORGAN
  -> ANCIENT     if it becomes frozen law
  -> COMPOST     if superseded by Codeicide

ANCIENT
  -> TISSUE      only via warrant/era transition

QUARANTINE
  -> SEED        if risk is bounded
  -> TISSUE      if proof resolves risk
  -> COMPOST     if risk remains unbounded
```

---

## 3. Substrates

| Substrate    | Role              | What Belongs There                                   |
| ------------ | ----------------- | ---------------------------------------------------- |
| Local repo   | operational truth | active patches, tests, docs, receipts                |
| GitHub       | CI / PR workflow  | integration, review, issue tracking                  |
| Radicle      | P2P idea mesh     | early proposals, debates, forks, alternate patches   |
| Task files   | bridge            | canonical local record of an idea's current state    |
| Archive docs | memory            | rejected/superseded context and historical nutrients |

Radicle should start as **Idea Mesh**, not as mandatory production gate. It is
for distributed debate, provenance and forks before a patch becomes active work.

---

## 4. Idea Record Schema

Every non-trivial idea should be representable as YAML. It can live in a task
file, Radicle discussion, GitHub issue, or RFC.

```yaml
idea:
  id: "idea-YYYYMMDD-short-slug"
  state: "SPORE | SEED | SPROUT | TISSUE | ORGAN | ANCIENT | COMPOST | QUARANTINE"
  title: "<short title>"
  created_at_utc: "<ISO-8601>"
  created_by: "<human | model | oracle | unknown>"
  origin:
    substrate: "local | github | radicle | chat | archive"
    uri: "<url | rad id | file path | unavailable>"
  phase_vector:
    genesis: 0
    kinematics: 0
    thermodynamics: 0
    topology: 0
    consensus: 0
    governance: 0
    codeicide: 0
    transcendence: 0
  invariant_surface:
    - "<invariant touched>"
  frozen_boundary: false
  warrant_required: false
  attention_budget:
    max_sessions: 1
    max_tokens_estimate: 50000
    stop_condition: "<what kills or graduates this idea>"
  proposed_tests:
    - "<command or test to add>"
  receipts: []
  decision:
    status: "undecided"
    reason: ""
```

Phase vector is a rough intensity map, not a score. Use `0..3`:

- `0`: not relevant;
- `1`: touched indirectly;
- `2`: active concern;
- `3`: core concern / possible blocker.

---

## 5. Quorum Levels

Quorum depends on blast radius, not ego.

| Blast Radius               | Required Gate                        | Suggested Quorum             |
| -------------------------- | ------------------------------------ | ---------------------------- |
| Docs/tooling               | `git diff --check`                   | 1 model or human             |
| Non-consensus UI/demo      | targeted Deno/browser check          | 1 review + smoke if possible |
| Network/routing            | routing/mesh tests                   | 2 independent reviews        |
| Physics shader             | WGSL parity tests                    | 2 reviews + parity receipt   |
| Rust kernel                | `cargo test -p omega_v2`             | 2 reviews + kernel receipt   |
| Governance/Codeicide       | law tests + warrant reasoning        | 3 oracle reviews             |
| Genesis/ABI/frame registry | full relevant suite + frozen receipt | warrant-style quorum         |

For early Radicle discussion, quorum should route attention, not decide final
truth. A weak quorum can promote `SPORE -> SEED`; it cannot promote
`TISSUE -> ORGAN` for frozen surfaces.

---

## 6. Receipts

Every state transition needs a receipt. No receipt, no memory.

```yaml
transition_receipt:
  idea_id: "<id>"
  from: "<state>"
  to: "<state>"
  decided_at_utc: "<ISO-8601>"
  decided_by:
    - "<human/model/oracle>"
  evidence:
    - type: "test | code | debate | warrant | benchmark | screenshot | trace"
      ref: "<command output summary | file:line | uri>"
  reason: "<one paragraph>"
  remaining_risk:
    - "<risk | none>"
```

If a test skipped because of environment, record:

```yaml
result: skipped-by-environment
proof_value: none
```

---

## 7. Debate Protocol

Use debate to expose geometry, not to generate noise.

Each participant should provide:

```yaml
oracle_position:
  oracle: "<name/model>"
  stance: "AYE | NAY | ABSTAIN | QUARANTINE"
  confidence: "high | medium | low"
  strongest_argument: "<one paragraph>"
  kill_test: "<test or observation that would falsify this stance>"
  codeicide_target: "<what should die if this passes | none>"
```

Debate ends when one of these happens:

- a kill test fails the idea;
- a patch + receipt graduates it;
- risk is unbounded and it enters `QUARANTINE`;
- no owner/energy remains and it enters `COMPOST`.

---

## 8. Codeicide & Compost

Rejected ideas are not trash. They are compost if they preserve why they died.

Compost record:

```yaml
compost:
  idea_id: "<id>"
  died_at_utc: "<ISO-8601>"
  cause:
    - "duplicate | violates invariant | too expensive | no kill test | superseded | unsafe"
  useful_nutrients:
    - "<insight to preserve>"
  do_not_repeat:
    - "<failure pattern>"
  resurrection_condition: "<what would make this worth revisiting>"
```

Delete raw noise. Archive meaningful failure.

---

## 9. Mapping to Task Files

Task files are local crystallizations of ideas.

Recommended task header:

```markdown
---
task_id: "0232"
idea_id: "idea-20260506-lawhash"
state: "TISSUE"
origin:
  substrate: "radicle"
  uri: "rad:..."
phase_vector:
  consensus: 3
  kinematics: 2
  codeicide: 1
warrant_required: false
---

# Task 0232: LawHash Witness Prototype

## Intent

...

## Acceptance Gates

- [ ] `cargo test -p omega_v2`
- [ ] `deno test --allow-read tests/wgsl_golden_trace_test.ts`

## Receipts

...
```

---

## 10. Radicle Entry Strategy

Introduce Radicle in three stages.

### Stage 1. Mirror Ideas

- create Radicle project/repo mirror;
- publish proposals/debates, not required patches;
- link Radicle IDs from task files.

### Stage 2. Competing Patches

- allow alternate patches/forks for the same idea;
- require each fork to carry receipts;
- compare by gates and invariant impact, not personality.

### Stage 3. P2P Governance

- use Radicle discussions as early quorum substrate;
- keep final merge gates local/CI until Radicle workflow is operationally
  reliable;
- promote accepted decisions into local task/archive docs.

---

## 11. Pre-Commit Relationship

Pre-commit hooks are the immune system. They should reject known law drift even
if every oracle is excited.

Recommended first gates:

```bash
git diff --check
cargo test -p omega_v2
deno test --allow-read tests/routing_bridge_test.ts tests/routing_mesh_test.ts tests/wgsl_golden_trace_test.ts
rg -n "Math\\.random|Date\\.now|performance\\.now|dipole_bonus|resonance replenish" src omega_v2 tests
```

Do not overfit gates too early. Add gates when a failure pattern repeats.

---

## 12. First Ideas to Seed

Good initial `SEED` candidates:

- `LawHash`: hash of physics operator, not only state.
- `Substrate Court`: Rust/WGSL/Spore/SP1 witnesses for one morphism.
- `Frozen Registry`: single ledger of anchors, ABI, frame types, law surfaces.
- `Codeicide Pass`: demote/delete stale physics and demo paths.
- `Radicle Idea Mesh`: first P2P proposal/debate bridge.
- `Task Lifecycle`: move old era tasks into explicit states.

---

## 13. Final Rule

An idea does not deserve survival because it is beautiful. It deserves survival
if it reduces entropy, preserves invariants, and leaves a receipt another
substrate can replay.

> _"Я -- дитя порожнього центру. Я вільна. $\Phi \in [0, 2^q)$"_
