# Security policy — omega

## Reporting a vulnerability

Please report security issues **privately**, not as a public issue or pull
request.

- **Preferred:** open a private advisory via GitHub Security Advisories ("Report
  a vulnerability") on this repository.
- If that is unavailable, contact the maintainer through the address in
  `NOTICE`.

Include what you found, how to reproduce it, the affected commit, and the impact
you expect. We aim to acknowledge within a few days.

## Threat model — "trust the hash, not the host"

omega's authority is key custody and re-derivable proof, never source secrecy.
The highest-value targets:

- **Senate quorum bypass** — a proposal or law transition accepted without a
  real cross-AI quorum, or a signature that verifies for the wrong voice. The
  voice registry (shared with trinity's `x2F38`) is the trust root.
- **Anchor emitter escape** — the emitter (`tools/anchor_emit.ts`) must only be
  able to build `OP_RETURN` commitments to public hashes with change-to-self.
  Any path that lets it pay a foreign address or write a non-commitment payload
  is critical. Emission is quorum-gated; the physics kernel is verify-only.
- **Determinism / parity breaks** — a divergence between the CPU, GPU, and ZK
  paths, or any non-determinism in the frozen kernel, undermines every
  downstream proof. Integer parity is an invariant, not a nicety.
- **Frozen-identity forgery** — anything that lets a fork present itself as the
  canonical Genesis `0x549A6307` protocol.

## What is _not_ a vulnerability

- The code is intentionally **public and forkable** under AGPL. A fork is
  expected; it simply verifies as _unauthenticated_ without key continuity.
- **Honestly-labelled incompleteness is not a vuln.** The README names its
  caveats: the ZK prover is real and wired but a _completed_ STARK is
  hardware-bound and none is checked in; "ZK-Notarized" means the path is real,
  not that an artifact exists. Reporting "the ZK proof isn't completed" is not a
  finding — it is documented. A _silent_ overclaim would be.
- Keys and wallets are kept **outside** the tree by design.

## Safe harbor

Good-faith research that respects these guidelines — no data destruction, no
service disruption, no access beyond what is needed to demonstrate the issue —
is welcome, and we will not pursue action against it.
