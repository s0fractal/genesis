# Licensing intent — OMEGA-64

> This document records the *reasoning* behind the licence choice. It is
> not itself a licence. The legally binding terms live in `LICENSE` and
> `NOTICE`. This file is for human readers, contributors, and a future
> draftsperson of a mycelium-aware bespoke licence.

## Current state (2026-05-23)

- **License**: GNU Affero General Public License v3.0 or later
  (`SPDX-License-Identifier: AGPL-3.0-or-later`).
- **Status**: interim, chosen as a stopgap.
- **Visibility**: repository is currently private on GitHub. License is
  applied so that *if and when* the repo is shared (even with one
  reviewer), the legal frame is unambiguous.

## What we are trying to protect

OMEGA-64 is not a standalone product. It is one of three federated
substrates (`omega`, `liquid`, `myc`) plus a meta-coordination layer
(`trinity`). Each substrate has its own authority:

- `liquid` may generate latent intent.
- `omega` may accept or reject bounded deterministic transitions.
- `myc` may publish and audit receipts.

The *value* of any one substrate alone is small. The value of the
federation — the ability for substrates to compose under shared
invariants — is large. The licence must therefore protect the
**federation**, not just the source code of `omega`.

## Why AGPL-3.0-or-later as the stopgap

AGPL is the closest *existing* license to the intent above, because:

1. **Network-use copyleft (§13).** Anyone running a modified OMEGA-64 as
   a network service must publish their modifications. This blocks
   "fork-and-host as closed SaaS" extraction, which is the most likely
   capture vector for substrate-style infrastructure.

2. **Derivative-works copyleft.** Anyone who builds a downstream
   substrate on OMEGA-64 source must keep that downstream open under
   compatible terms. This preserves the "mycelium" property — derivatives
   remain composable.

3. **Permissive enough for research.** Academic study, personal
   experiments, classroom use, and the audit being requested today are
   all unambiguously allowed.

4. **Disliked by closed-shop enterprises.** This is a feature, not a bug.
   Enterprises that would integrate omega into closed products
   self-select away. Substrates that want to be part of the mycelium
   self-select in.

## Why this is *only* a stopgap

AGPL was written for traditional software (one program, one network
service, one corporate owner). It does not say anything about:

- **Substrate federation.** Multiple substrates that each preserve their
  own authority; cross-substrate composition under shared invariants
  rather than code import.
- **Cryptographic identity anchoring.** Genesis hashes, Bitcoin
  inscriptions, deterministic Senate identities. The licence does not
  speak to whether a fork that strips Bitcoin attestation is a *valid*
  derivative or a separate work.
- **Voice authorship.** Substantial contributions come from LLM voices
  (claude, codex, gemini, kimi, antigravity). Their relationship to
  copyright in any of their jurisdictions is unsettled; AGPL is silent.
- **Mycelium reciprocity.** A bespoke licence might say: derivatives are
  free to use omega, but if they want their substrate to be recognised
  as part of the federation (e.g. accepted by `myc`'s witness layer or
  by `omega`'s Senate), they must follow specific reciprocity rules.

A bespoke "mycelium-aware" licence is on the roadmap. Possible names:
SPL (Substrate Public License), FPL (Federation Public License), or
something derived from the existing protocol vocabulary. Drafting it
requires reaching consensus across substrates and is not blocking the
current audit.

## Boundary conditions for the bespoke licence (when drafted)

Things the bespoke licence MUST preserve from AGPLv3:

- Right to study, modify, and run the code privately.
- Network-use copyleft for unmodified-protocol forks.
- Compatibility with derivative-works copyleft.

Things the bespoke licence MAY add on top of AGPLv3:

- Explicit recognition of cryptographic identity continuity (Bitcoin
  anchor, Genesis hash).
- Reciprocity rules for federation membership separate from raw code
  reuse.
- Voice-authorship attribution norms.
- Substrate-court arbitration when the licence text is ambiguous.

Things the bespoke licence MUST NOT introduce:

- Centralised licence-grant authority (would contradict "no node has
  elevated rights" — invariant I-6).
- Discrimination against fields of endeavour (would fail
  open-source-definition).
- Royalty or per-seat charges (would fail mycelium reciprocity).

## How to interpret the current state

- For the **one-person audit** the architect is requesting: AGPLv3
  applies. The reviewer may read, run, and comment without restriction.
  They do not need to publish their review unless they network-host a
  modified copy.
- For **any other party** finding the repo: read, study, fork is
  allowed under AGPLv3 terms. Public deployment must publish source.
- For **myc / liquid / trinity**: separately licensed (currently
  unlicensed, all rights reserved). AGPL on omega does not propagate
  to them because their relationship is federation (file-projection),
  not code-derivative.

---

*This file is intentionally non-binding. The legally binding terms live
in LICENSE and NOTICE. This file exists so future contributors and the
eventual bespoke-licence drafter understand the original intent.*
