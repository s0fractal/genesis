# Legacy V1 Fixtures (Era ≤ 700)

These scripts target the deprecated `omega_core` (v1, wasm-bindgen) crate.
They are kept for historical reference only — V2 (`omega_v2`, no_std) is
the active source of truth.

If you need to revive a script, port it to the V2 FFI surface in
`src/network/routing_bridge.ts` or the bridges in `src/environment/`.

| File | Purpose | Why deprecated |
|---|---|---|
| `debug_console.ts` | Puppeteer console scraper | targets old DOM HUD |
| `test_epigenetics.ts` | pure_lambda morphology test | uses v1 compiler path |
| `test_serialization.ts` | ontology persistence test | uses v1 plasmid registry |
| `test_wgsl.ts` | v1 PhaseComputeEngine smoke | uses omega_core/pkg |
