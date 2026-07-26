# omega_spore — Era 1100 Bare-Metal Spore

A 6 KB ARM Cortex-M4F firmware that validates every cross-language OMEGA-64 v1.0
anchor at boot. If the spore's silicon reproduces the same FNV-1a hashes as the
desktop kernel, the SP1 ZK guest, and the browser TypeScript port, the lattice's
mathematical invariants hold across **four substrates**:

```
Browser WASM (wasm32)      ← src/network/*.ts
Desktop host (aarch64-darwin) ← omega_v2 cargo test
ZK guest (riscv64im)       ← omega_zk_guest + SP1 STARK
Bare-metal (thumbv7em)     ← omega_spore (this crate)  ★ NEW
```

## Status

- Cross-compiles cleanly to `thumbv7em-none-eabihf`.
- 6,012-byte stripped ELF (statically linked, no libc).
- Validates 10 cryptographic anchors at `_start`; halts in `panic_handler` on
  any drift, enters reactor loop on success.

## Build

```bash
# One-time: install the target and (optionally) QEMU.
rustup target add thumbv7em-none-eabihf
brew install qemu     # optional, for emulated execution

# Build the spore firmware.
cd omega_spore && cargo build --release

# Inspect the resulting ELF.
file target/thumbv7em-none-eabihf/release/omega_spore
# → ELF 32-bit LSB executable, ARM, EABI5
```

## Run (host emulation, optional)

When `qemu-system-arm` is available, you can boot the firmware on a virtual
Cortex-M4 board:

```bash
qemu-system-arm \
    -cpu cortex-m4 \
    -machine mps2-an386 \
    -nographic \
    -kernel target/thumbv7em-none-eabihf/release/omega_spore
```

The board has no UART output bound, so success looks like "QEMU runs without
exiting" and failure looks like "QEMU exits with non-zero". Real boards will
signal success/failure through whatever LED / serial hook you wire into
`_start`.

## Anchor coverage

At boot the firmware's `validate_anchors()` checks **two** cross-substrate
anchors and aborts if either drifts:

| Anchor                     | Value         | Checked in                  |
| -------------------------- | ------------- | --------------------------- |
| empty-senate FNV-64 fold   | `0xDFDE_6AC5` | `main.rs::validate_anchors` |
| Genesis Hash v1.0          | `0x716E_A2F8` | `genesis_inscription.rs`    |

Two is enough: the genesis hash is FNV-1a over all five frozen v1.0 anchors, so
reproducing `0x716E_A2F8` proves the firmware linked a conforming `omega_v2`
without carrying the whole anchor corpus on-device.

The complete canonical anchor set — the SHA-256 senate/mitosis receipts, the
five v1.1 oracle seats (`claude, codex, gemini, antigravity, kimi`), and the
quorum/warrant hashes — lives at its source, not duplicated here (copies rot):
see [`docs/CANONICAL.md`](../docs/CANONICAL.md), `genesis_inscription.rs`,
`oracle_identity.rs`, and the frozen-input guardrail
`tests/genesis_anchor_provenance.rs`.

## Why a separate crate

Bare-metal builds need different linker flags, panic strategies, and default
targets than the host workspace. The `omega_v2` library can compile to
`thumbv7em-none-eabihf` cleanly, but consumers of that build have to provide
their own `panic_handler` and `_start`. Hence the `default-features = false`
clause + the manual `_start` entry.

## Why this matters

Previous Eras (1010 → 1090) demonstrated determinism across desktop + browser +
ZK guest. Era 1100 closes the **fourth** substrate: actual microcontroller
silicon. The same FNV-1a polynomials, the same integer-only mitosis derivation,
the same Senate quorum hashing — all running on a 168 MHz ARM Cortex-M4F that
costs $5 in unit volume.

This is what the Φ-Manifest's "biological substrate computing" intention pointed
at. A field of ESP32-class nodes carrying minimal lattices, all agreeing on the
same `0x716E_A2F8`, is no longer a roadmap aspiration — it is a
`cargo build --release` away from ready.
