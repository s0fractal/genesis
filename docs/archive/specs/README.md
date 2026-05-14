# Archived Protocol Schemas

## `omega64.proto` / `omega_v2.proto`

Protobuf-схеми для cross-language orchestration (Rust/Go/Python), що були частиною roadmap Era 300–500. Generated bindings (`omega64.js`, `omega64.d.ts`, `omega_v2.js`, `omega_v2.d.ts`) видалені, бо ніде не імпортувались в active коді.

**Статус:** Frozen vision. Якщо колись знадобиться cross-substrate RPC — ці схеми можуть стати seed'ом, але v2 kernel використовує власний compact binary format (`phi_protocol.rs`), не protobuf.

**Збережено:** як forensic spec, не як build artifact.
