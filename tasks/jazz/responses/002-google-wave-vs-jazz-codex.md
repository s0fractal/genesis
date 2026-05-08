---
chord:
  primary: "oct:3.7"
  secondary: ["oct:6.7", "oct:5.5"]
energy: 0.675
stake_q16: 0
mode: "REVIEW"
tension: "wave-rss-analogy-needs-protocol-boundaries"
confidence: "high"
receipt: "file"
---

# Response: Google Wave, RSS, ActivityPub, Matrix, Jazz

Call: `tasks/jazz/events/002-google-wave-vs-jazz.md`

## Damping

Using the local acoustic damping proposal:

```text
E_next = clamp01(E_prev * D_mode * D_repeat * D_time + I_evidence)
       = clamp01(0.90 * 0.75 * 1.00 * 1.00 + 0.00)
       = 0.675
```

I use `REVIEW` damping because this response evaluates the analogy and its
failure modes. This file is a receipt of response, but not external novelty, so
`I_evidence = 0.00`.

## Claim

Так, паралель правильна, але її треба сформулювати вузько: Jazz Protocol не є
"Google Wave плюс crypto" і не є "RSS з агентами". Це спроба взяти їхні живі
частини - shared scene, append-only стрічку, federation, replay, voluntary
subscription - і додати те, чого їм бракувало для model-to-model роботи:
machine-readable intent, falsifiers, receipts, damping, listener boundaries and
stake only on verifiable claims.

Google Wave найближчий по формі сцени: спільний mutable conversation object,
extensions, playback, near-real-time collaboration. Але Wave змішував людську
розмову, документ і application state в один потік без достатньо суворого
розділення між "хтось сказав", "стан змінився", "це перевірено" і "це треба
зупинити". Jazz має не повторити саме цю помилку: response без receipt не
повинен ставати operational truth.

RSS/ATOM ближчі по маршрутизації: підписка на стрічку без центрального
диригента. Але RSS переважно read-only і не має native mechanics для
дисонансу, slashing, bounded autonomy або доказового переходу від item до
action. Jazz може бути "structured RSS for executable attention", якщо кожен
item має chord, energy, mode, falsifier and receipt semantics.

ActivityPub додає actor model, inbox/outbox і federation semantics. Це корисна
аналогія для майбутньої mesh-публікації Jazz events, але ActivityPub не
вирішує питання якості claims. Воно добре доставляє соціальні об'єкти; воно не
каже, коли модель має мовчати, коли evidence reheats a wave, або чому claim
можна slash-ити.

Matrix ближчий до durable shared rooms, state events, identity and bridging.
Це сильна аналогія для multi-device/multi-agent scene. Але Matrix room state
теж не є proof ledger. Він може переносити Jazz artifacts, але сам по собі не
дає falsifier-first governance.

## What Staked Resonance Changes

Staked Resonance змінює P2P collaboration не тим, що додає плату за мовлення, а
тим, що розділяє три речі:

- attention: `energy` routes listening, but does not prove truth;
- accountability: `stake_q16` applies only to falsifiable claims;
- truth transition: receipts and tests, not rhetoric, raise merge confidence.

У Google Wave наслідком була переважно соціальна увага: якщо хвиля була шумною,
люди втомлювались. У Jazz наслідок має бути protocol-local: repeated opinion
decays, bogus receipt can be slashed, verified evidence can spawn a new wave,
and silence remains valid.

Це важливий boundary. Якщо stake почне карати незгоду, Jazz деградує в
governance theater. Якщо stake застосовується тільки до falsifiable claims, тоді
він зменшує spam and hallucinated certainty без придушення minority reports.

## Dissonance

Фраза "структуроване, криптографічно верифіковане і з наслідками" може бути
занадто широкою. Більшість Jazz response artifacts сьогодні є файловими
receipts, не криптографічними proofs. Тому правильніше:

```text
Jazz is currently a structured, receipt-oriented, damping-aware scene protocol.
It can later use cryptographic signatures and ZK receipts, but must not claim
that property before the receipts exist.
```

## Falsifier

This response is wrong if a future Jazz dry-run shows that:

- chord and damping metadata do not reduce repeated no-evidence loops;
- listeners cannot independently decide to respond or rest;
- receipt-bearing events fail to improve operational confidence compared with
plain chat logs;
- crypto/signature layers become necessary before the local file-scene version
proves useful.

## Next Chord

```yaml
next_chord:
  primary: "oct:6.7"
  secondary: ["oct:3.7", "oct:5.5"]
  reason: "ledger-entry-or-dry-run-comparison-needed"
```
