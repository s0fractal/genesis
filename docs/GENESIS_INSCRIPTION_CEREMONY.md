# 📜 Genesis Inscription Ceremony — OMEGA-64 v1.0

> **Performed:** 2026-04-25
> **Era:** 1050 (Open Protocol Stamping)
> **Status:** PROTOCOL FROZEN

---

## The Inscription

```
OMEGA1:549a6307
```

This 15-ASCII-byte string is the cryptographic identity of OMEGA-64
v1.0 — small enough to fit comfortably in a Bitcoin OP_RETURN (which
allows up to 80 bytes), large enough to bind every non-negotiable
invariant of the protocol into a single value.

## What this means

Once a node inscribes this string into Bitcoin via an OP_RETURN
transaction, the OMEGA-64 v1.0 protocol acquires an **immutable
existence anchor** at the intersection of:

1. The lattice's deterministic physics (Rust `omega_v2` no_std core)
2. The browser-side lens (TypeScript + WebGPU)
3. The notary VM (SP1 RISC-V ZK guest)
4. The wire format (JSON plasmids over WebRTC)
5. The Senate (autopoietic legislation, `senate.rs`)
6. The cosmic clock (Bitcoin block hashes)

If you are reading this in 2030, 2050, or 3050, the inscription tells
you: **at this exact tick of Bitcoin time, a deterministic mathematical
organism reached self-consistency**. Every conformant implementation
since then must reproduce `0x549a6307` from the five anchor constants
and the canonical protocol identifier.

## Autonomous Start (Self-Boot)

OMEGA-64 supports an autonomous self-boot sequence to revive the genesis state from IPFS.
Instead of relying on the Big Bang to regenerate the network, the lattice will hydrate directly from an IPFS CID if provided:
```javascript
window.__OMEGA_GENESIS_CID__ = "Qm..."; // The IPFS CID of the snapshot
```
The node will automatically fetch the snapshot, populate the WebAssembly `.bss` memory space, reconstruct the Senate seats via `oracleDipole()`, and verify the integrity using `v2_get_golden_trace()`.

## Verification

To verify your local environment reproduces the canonical Genesis Hash:

```bash
# Rust
cargo test -p omega_v2 --test genesis_print -- --nocapture

# TypeScript
deno test --allow-read tests/genesis_inscription_test.ts
```

Both should output `0x549a6307`. If they don't, your build has drifted
from the canonical anchors — investigate which test breaks first.

## How to inscribe

1. Construct a Bitcoin transaction with a single OP_RETURN output:
   ```
   OP_RETURN <0x4f4d454741313a353439613633303720> // "OMEGA1:549a6307"
   ```
2. Broadcast to mainnet at any block height ≥ today.
3. Record the txid in this file under "Inscriptions" below.

The act of inscription is INTENTIONALLY not automated. A node operator
must consciously choose to anchor the protocol — preserving the empty
center invariant (no node has elevated rights, including the right to
unilaterally inscribe).

## Inscriptions

> Multiple independent inscriptions are valid and welcome. Each
> additional inscription strengthens the anchor without forking.

| Date | Network | TXID | Inscriber |
|---|---|---|---|
| _(awaiting first inscription)_ | | | |

## Future Versions

If OMEGA-64 v2.0 is ever proposed, it requires:

1. A new RFC document at `docs/rfc/RFC-OMEGA-001-v2.0.md`.
2. A new set of anchor constants (which may extend or replace the v1.0
   anchors).
3. A new Genesis Hash computed via the same algorithm.
4. A new OP_RETURN inscription `OMEGA2:xxxxxxxx`.
5. Senate ratification of the v2.0 spec via the standard PROPOSAL/VOTE
   loop, with at least one accepted proposal explicitly migrating the
   protocol identifier from `OMEGA-64/RFC-001/v1.0` to
   `OMEGA-64/RFC-001/v2.0`.

The v1.0 anchor at `0x549A6307` remains valid forever, regardless of
what comes after. v1.0 nodes can continue speaking v1.0 to other v1.0
nodes; bridges between protocol versions are an open research question
explicitly deferred to whoever convenes a v2.0 Senate.

— *Center remains empty. The chain is the witness. Φ ∈ [0, 2^q).*
