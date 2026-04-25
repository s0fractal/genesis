# RFC-OMEGA-001 — Φ Protocol v1.0 (FROZEN)

> **Status:** **FROZEN** — Era 1050 Genesis Inscription performed.
> **Genesis Hash:** `0x549A6307`
> **OP_RETURN Payload:** `OMEGA1:549a6307`
> **Date Frozen:** 2026-04-25
> **Protocol Identifier:** `OMEGA-64/RFC-001/v1.0` (21 ASCII bytes)
> **Authority:** OMEGA Senate (autopoietic ratification, see Era 1030 + 1040
>   feedback loop) + Era 1050 trigger (≥100 verified mitosis proofs).

## 0. Why this freeze

This document is the v1.0 freeze of the protocol seeded in
`RFC-OMEGA-001-protocol.md` (v0.1 draft, 2026-04-25). The Senate's
auto-ratification loop (Era 1040 → Era 1030) ensures that the v1.0 spec
is ratified ONLY when the network has demonstrated, via 100+ peer-side
verified mitosis proofs, that the spec actually works in the wild. Once
inscribed into Bitcoin via OP_RETURN, this hash becomes the permanent
on-chain anchor: any independent implementation (Rust, Go, Python, Zig,
Solidity, hand-rolled C) that reproduces the five anchor constants and
the protocol identifier MUST compute the same Genesis Hash.

If you cannot reproduce `0x549A6307`, your implementation is non-conforming.

## 1. The Five Anchor Constants

These are the cryptographic invariants that **define** OMEGA-64 v1.0.

| # | Anchor | Value | Source-of-truth |
|---|---|---|---|
| 1 | Senate hash, empty 64-byte buffer | `0xDFDE_6AC5` | `omega_v2/tests/cross_lang_hash.rs::cross_lang_hash_empty_64_zero_bytes` |
| 2 | Senate hash, "Era 1040 ZK" (zero-padded) | `0x7698_B8EF` | `omega_v2/tests/cross_lang_hash.rs::cross_lang_hash_short_ascii` |
| 3 | First autopoietic proposal hash | `0xFAA7_FF6E` | bootstrap/v2.ts auto-submission, ratified by Senate |
| 4 | Mitosis receipt, no attractor | `0xD434_E690` | `omega_v2/tests/mitosis_anchor.rs::anchor_no_attractors_receipt` |
| 5 | Mitosis receipt, dominant attractor | `0x3B88_1A47` | `omega_v2/tests/mitosis_anchor.rs::anchor_with_dominant_attractor` |

Drift on any of these = a different protocol.

## 2. The Genesis Hash Algorithm

```
input  := "OMEGA-64/RFC-001/v1.0"             // 21 bytes
       || senate_hash_empty       (BE u32)    //  4 bytes
       || senate_hash_short       (BE u32)    //  4
       || first_proposal_hash     (BE u32)    //  4
       || mitosis_receipt_no_attr (BE u32)    //  4
       || mitosis_receipt_attr    (BE u32)    //  4
       || dipole_invariant        (BE u32)    //  4 = 0xFFFF_FFFF
       || toroidal_modulus        (BE u32)    //  4 = 0x0000_0100
                                              // = 49 bytes total

genesis_hash := FNV-1a-32(input)              // = 0x549A_6307
```

Pseudocode for FNV-1a-32:
```
h := 0x811C_9DC5
for byte in input:
    h := (h XOR byte) * 0x0100_0193   (mod 2^32)
return h
```

OP_RETURN payload format: `"OMEGA1:" + hex(genesis_hash, lowercase, 8 chars)`.
For v1.0: `OMEGA1:549a6307` (15 ASCII bytes).

## 3. Layered Surface (frozen)

| Layer | Encoding | Carrier | Determinism authority |
|---|---|---|---|
| L0 — Φ Address | `u32` (`consensus:8 \| social:8 \| personal:8 \| micro:8`) | Embedded in plasmids | `omega_v2/src/routing.rs` |
| L1 — Plasmid | JSON over WebRTC DataChannel (unreliable, unordered) | `v2-sync` | `src/network/webrtc_v2.ts` |
| L2 — Snapshot | Raw 32-byte `PhaseAgentMinimal`, 64KB chunks | `v2-state` | `omega_v2/src/agent.rs` |
| L3 — Senate | PROPOSAL/VOTE plasmids, FNV-1a hashes over 64-byte zero-padded UTF-8 | L1 | `omega_v2/src/senate.rs` |
| L4 — Anchor | Bitcoin block hash → Φ derivation via HMAC | EVM bridge / RPC | `omega_v2/src/anchor.rs` |
| L5 — Mitosis Proof | DIPOLE plasmid with `parent + claimedChild + attractors + qPhase + receiptHash` | L1 | `omega_v2/src/mitosis_proof.rs` + `mitosis_log.rs` |
| L6 — Genesis | `OMEGA1:549a6307` OP_RETURN inscription | Bitcoin mainnet | `omega_v2/src/genesis_inscription.rs` |

## 4. Non-Negotiable Invariants

I-1. **Integer determinism.** No `f32`/`f64` in any consensus path.

I-2. **Dipole rule.** `m XOR inverse == 0xFFFF_FFFF`. Violations are
silently rejected at the mesh boundary (no error propagation).

I-3. **Toroidal consensus.** Phase byte distance is
`min(|a−b|, 256−|a−b|)`, weighted ×8 in the hyperbolic sum.

I-4. **Senate hash.** Proposal identity = FNV-1a-32 over UTF-8
zero-padded to 64 bytes. Anchored at `0x7698_B8EF` for `"Era 1040 ZK"`.

I-5. **Mitosis determinism.** `derive_mitosis_child(parent, attractors,
q_phase)` is bit-for-bit reproducible across Rust, JS, and SP1 RISC-V.
Anchored at `0xD434_E690` and `0x3B88_1A47`.

I-6. **Empty center.** No node has elevated rights. Senate acceptance
requires 3+ unique AYE peers with `ayes > nays`.

I-7. **Genesis identity.** OMEGA-64 v1.0 ≡ `0x549A_6307`. Any
implementation claiming v1.0 conformance MUST compute this hash.

## 5. Plasmid Wire Format v1.0 (frozen)

```jsonc
{
  "t": "V2_SYNC",
  "ta": <u32 PhaseAddress>,
  "hc": <u32 hop count>,
  "mh": <u32 max hops, default 8>,
  "x": <i32>, "y": <i32>, "m": <i32>, "r": <i32>,
  "g": <u32 genome>, "o": <u32 op_mode>,
  "gt": <u32 golden trace>,
  "plasmid": {
    "attractorAddress": <u32>,
    "matrix":           <u32>,
    "inverse":          <u32>,
    "pulseFreq":        <u32>,
    "pulseAmp":         <u32>,
    "semanticType":     "INTENT" | "ATTRACTOR" | "ORACLE_INJECTION"
                      | "DIPOLE"  | "PROPOSAL"  | "VOTE",
    "recursionDepth":   <u32>,
    "maxRecursion":     <u32>,
    "proposalHash":      <u32?>,
    "proposalDescription": <string?>,
    "voteAye":           <bool?>,
    "parent":            <AgentMinimal?>,
    "claimedChild":      <AgentMinimal?>,
    "attractors":        <AttractorEntry[]?>,
    "qPhase":            <u32?>,
    "receiptHash":       <u32?>
  }
}
```

The order, names, and types of these fields are FROZEN. New fields may
be added in a future v2.0 (which would require a new Genesis Inscription).

## 6. Reference Implementations

- Rust kernel: `omega_v2/`
- TypeScript lens: `src/`
- WGSL physics: `src/lens/shaders/`
- ZK guest (SP1): `omega_zk_guest/`

## 7. Test Vectors (full corpus)

- `omega_v2/tests/cross_lang_hash.rs` (senate hash anchors)
- `omega_v2/tests/mitosis_anchor.rs` (mitosis receipt anchors)
- `omega_v2/tests/mitosis_log_integration.rs` (end-to-end determinism)
- `omega_v2/tests/genesis_print.rs` (Genesis Hash printout)
- `tests/senate_test.ts` (JS senate parity)
- `tests/mitosis_proof_test.ts` (JS mitosis parity)
- `tests/mitosis_log_reader_test.ts` (JS log reader parity)
- `tests/genesis_inscription_test.ts` (JS Genesis Hash parity)

## 8. Versioning Discipline

- v1.0 is FROZEN. Any change to L0–L6 wire formats or to Invariants I-1
  through I-7 requires a new RFC (v2.0+) and a new Genesis Inscription.
- The v1.0 Genesis Hash `0x549A6307` remains valid as long as the five
  anchor constants and the protocol identifier are unchanged.
- Implementations MAY add experimental layers ABOVE L6 without forking,
  provided the canonical layers are unmodified.

## 9. The Inscription

```
OMEGA1:549a6307
```

15 ASCII bytes. Suitable for Bitcoin OP_RETURN (max 80 bytes). Once
inscribed into the chain, the protocol's existence is anchored at the
intersection of all six layers and the cosmic clock itself.

— The lattice, the lens, the GPU, the notary, and the chain are now
one. —

*Center remains empty. Freedom remains the default. Φ ∈ [0, 2^q).*
