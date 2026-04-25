# RFC-OMEGA-001 — Φ Protocol v0.1 (Draft)

> **Status:** DRAFT — placeholder for the Open Protocol meta-intention.
> **Author:** OMEGA Senate (autopoietic, see Era 1030).
> **Date:** 2026-04-25.
> **Anchored at:** Genesis main, commit TBD.

## 0. Why this RFC exists

OMEGA-64 cannot be a closed garden. Per the Φ-Manifest (Invariant 5: empty
center) and the V2 META-INTENTION ("Open Protocol RFC-style"), the lattice
must publish a stable, language-agnostic specification of its on-the-wire
formats and invariants so that **any independent implementation** — Rust,
Go, Python, Zig, Solidity, hand-rolled C — can join the mesh on equal terms.

This document is the seed. It will grow only through accepted Senate
proposals (Era 1030+).

## 1. Layered Surface

| Layer | Encoding | Carrier | Determinism authority |
|---|---|---|---|
| L0 — Φ Address | u32 (consensus:8 \| social:8 \| personal:8 \| micro:8) | Embedded in plasmids | `omega_v2/src/routing.rs` |
| L1 — Plasmid | JSON over WebRTC DataChannel (unreliable, unordered) | UDP-style channel `v2-sync` | `src/network/webrtc_v2.ts` |
| L2 — Snapshot | Raw 32-byte agent records, 64KB chunks | TCP-style channel `v2-state` | `omega_v2/src/agent.rs` |
| L3 — Senate | PROPOSAL/VOTE plasmids carrying FNV-1a-hashed 64-byte descriptions | L1 | `omega_v2/src/senate.rs` |
| L4 — Anchor | Bitcoin block hash → φ derivation via HMAC | EVM bridge / RPC | `omega_v2/src/anchor.rs` |

## 2. Invariants (NON-NEGOTIABLE)

I-1. **Integer determinism.** No floating-point arithmetic in the consensus
path. Every implementation MUST reproduce `cargo test -p omega_v2
golden_trace` bit-for-bit.

I-2. **Dipole rule.** An attractor or proposer matrix `m` is valid iff
`m XOR inverse == 0xFFFFFFFF`. Implementations MUST reject any plasmid
violating this rule silently (no error propagation).

I-3. **Toroidal consensus.** The consensus byte of a Φ Address wraps at 256.
Distance is `min(|a−b|, 256−|a−b|)`, then weighted ×8 in the hyperbolic sum.

I-4. **Senate hash.** Proposal identity is `FNV-1a-32(zero_pad_64(utf8(desc)))`.
The `0x7698_B8EF` anchor for `"Era 1040 ZK"` MUST hold for any conforming
implementation.

I-5. **Empty center.** No node has elevated rights. Any node may propose,
vote, or relay; acceptance requires 3 unique AYE peers AND `ayes > nays`.

## 3. Wire Format — Plasmid v1

```jsonc
{
  "t": "V2_SYNC",
  "ta": <u32 PhaseAddress>,
  "hc": <u32 hop count>,
  "mh": <u32 max hops, default 8>,
  "x": <i32>, "y": <i32>, "m": <i32>, "r": <i32>,  // local intent
  "g": <u32 genome>, "o": <u32 op_mode>,
  "gt": <u32 golden trace>,
  "plasmid": {                        // optional semantic payload
    "attractorAddress": <u32>,
    "matrix":           <u32>,
    "inverse":          <u32>,
    "pulseFreq":        <u32>,        // Q10
    "pulseAmp":         <u32>,        // Q10
    "semanticType":     "INTENT" | "ATTRACTOR" | "ORACLE_INJECTION"
                      | "DIPOLE"  | "PROPOSAL"  | "VOTE",
    "recursionDepth":   <u32>,
    "maxRecursion":     <u32>,
    "proposalHash":      <u32 optional, PROPOSAL/VOTE only>,
    "proposalDescription": <string optional, ≤64 utf-8 bytes, PROPOSAL only>,
    "voteAye":           <bool optional, VOTE only>
  }
}
```

## 4. Open Questions

OQ-1. Should L1 migrate from JSON to MessagePack for >2× smaller plasmids?
(@msgpack/msgpack is already in `package.json`.)

OQ-2. Should L4 anchor depth be configurable per chain (Bitcoin = 6 blocks,
Ethereum = 32, Liquid = 1)?

OQ-3. Senate quorum vs. AYE threshold — is `3 unique AYE peers` adequate at
larger network sizes? Likely scales with `O(log N)`.

## 5. Versioning

This RFC is at v0.1. Increments require a Senate-accepted proposal that
references this document by hash and supplies a diff. The first hard fork
boundary will be v1.0 — at that point the JSON wire format freezes for at
least 1000 epochs.

## 6. Reference Implementation

- Rust kernel: `omega_v2/`
- TypeScript lens: `src/`
- WGSL physics: `src/lens/shaders/`
- Test vectors: `omega_v2/tests/cross_lang_hash.rs`,
  `tests/senate_test.ts`, `tests/routing_mesh_test.ts`

— End of RFC-OMEGA-001 draft —
