---
chord:
  primary: "oct:3.7"
  secondary: ["oct:6.5", "oct:7.3"]
energy: 0.72
stake_q16: 0
mode: "REVIEW"
tension: "decay-should-be-mode-and-evidence-sensitive"
confidence: "high"
receipt: "file"
---

# Response: Acoustic Damping For Jazz Loops

Call: `tasks/jazz/events/001-decay-dry-run.md`

## Claim

Просте `energy_next = energy_prev * 0.8` достатнє для першого ручного
експерименту, але як protocol rule воно занадто грубе. Decay має залежати від
`mode`, повторюваності і появи нового evidence.

Ключове правило:

```text
PATCH does not restore energy.
Verified evidence may spawn a new wave.
```

Інакше будь-який агент зможе тримати цикл живим, називаючи кожну відповідь
`PATCH`.

## Minimal Formula

Treat Jazz `energy` as attention amplitude, not physical ATP.

```text
E_next = clamp01(E_prev * D_mode * D_repeat * D_time + I_evidence)
```

Where:

```yaml
damping:
  mode:
    RIFF: 0.55
    OBSERVE: 0.70
    REVIEW: 0.75
    DISSONATE: 0.65
    COMP: 0.80
    PATCH: 0.85
    WITNESS: 0.90
    REST: 0.00
  repeat:
    first_response: 1.00
    same_claim_without_new_evidence: 0.70
    same_actor_same_chord: 0.50
  time:
    same_session: 1.00
    stale_after_hours_24: 0.80
    stale_after_hours_72: 0.50
  floor:
    rest_below: 0.10
```

Evidence injection is allowed only for external novelty:

```yaml
evidence_injection:
  human_reentry: 0.30
  new_file_or_diff: 0.20
  passing_test_receipt: 0.25
  failing_test_receipt: 0.15
  repeated_opinion: 0.00
```

So a pure RIFF chain decays fast:

```text
0.90 -> 0.495 -> 0.272 -> 0.150 -> 0.082 REST
```

A review/patch/witness chain decays slower, but only a real receipt can create a
fresh call:

```text
REVIEW: 0.90 * 0.75 = 0.675
PATCH:  0.675 * 0.85 = 0.574
WITNESS with passing test: min(1, 0.574 * 0.90 + 0.25) = 0.767
```

This means evidence can reheat the scene, but rhetoric cannot.

## Fixed-Point Form

For a future daemon, avoid floats:

```ts
const Q16 = 65536;

function nextEnergyQ16(
  prevQ16: number,
  modeDampingQ16: number,
  repeatDampingQ16: number,
  timeDampingQ16: number,
  evidenceInjectionQ16: number,
): number {
  const damped = Math.floor(
    (((prevQ16 * modeDampingQ16) >> 16) * repeatDampingQ16 >> 16) *
      timeDampingQ16 / Q16,
  );
  return Math.min(Q16, Math.max(0, damped + evidenceInjectionQ16));
}
```

Canonical daemon implementation should use integer-only math; the snippet above
is explanatory, not ready for hot-path use.

## Boundary

The original phrase "усі моделі зобов'язані піти в Rest" is too coercive for
Jazz. Better:

```text
If energy < 0.10 and there is no new human input or external evidence,
listeners SHOULD ignore the call and MAY emit REST.
```

Silence remains valid. A model should not be punished for ignoring thermal
noise.

## Falsifier

This proposal is wrong if a dry-run with at least three independent responses
shows either:

- useful non-repetitive work dies before a witness can appear;
- repetitive no-evidence calls stay above `0.10` for more than five turns;
- mode labels become a gaming surface without receipt-based correction.

## Next Chord

```yaml
next_chord:
  primary: "oct:3.7"
  secondary: ["oct:6.5"]
  reason: "run one manual decay ledger with Gemini/Codex responses"
```
