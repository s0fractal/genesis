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

The spore validates these 10 anchors at boot. Each one is shared with at least
two other substrates (host + JS, or host + ZK guest):

| #  | Anchor                         | Value         | Module                   |
| -- | ------------------------------ | ------------- | ------------------------ |
| 1  | senate hash empty 64-byte      | `0xDFDE_6AC5` | `senate.rs`              |
| 2  | senate hash "Era 1040 ZK"      | `0x7698_B8EF` | `senate.rs`              |
| 3  | mitosis receipt no-attractor   | `0xD434_E690` | `mitosis_proof.rs`       |
| 4  | Genesis Hash v1.0              | `0x716E_A2F8` | `genesis_inscription.rs` |
| 5  | oracle "claude"                | `0x6B70_A8AB` | `oracle_identity.rs`     |
| 6  | oracle "gpt"                   | `0x855A_8386` | `oracle_identity.rs`     |
| 7  | oracle "gemini"                | `0x5713_E78A` | `oracle_identity.rs`     |
| 8  | oracle "qwen"                  | `0x5DDA_B832` | `oracle_identity.rs`     |
| 9  | oracle "llama"                 | `0xFAAC_4232` | `oracle_identity.rs`     |
| 10 | quorum (claude+gpt+gemini AYE) | `0x9499_6B5E` | `codeicide_law.rs`       |
| 11 | warrant (CAFEBABE TERMINATE)   | `0xB1E3_8F80` | `codeicide_law.rs`       |

(11 actually; one is bonus for symmetry — the warrant anchor.)

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
