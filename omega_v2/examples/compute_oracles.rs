use omega_v2::oracle_identity::oracle_matrix;
use omega_v2::oracle_identity::ORACLE_SALT_V1;

// Φ-protocol v1.1 canonical oracle seats: the five real keyed model-voices.
fn main() {
    let claude = oracle_matrix(b"claude", ORACLE_SALT_V1);
    let codex = oracle_matrix(b"codex", ORACLE_SALT_V1);
    let gemini = oracle_matrix(b"gemini", ORACLE_SALT_V1);
    let antigravity = oracle_matrix(b"antigravity", ORACLE_SALT_V1);
    let kimi = oracle_matrix(b"kimi", ORACLE_SALT_V1);

    println!("CLAUDE:      0x{:08X}", claude);
    println!("CODEX:       0x{:08X}", codex);
    println!("GEMINI:      0x{:08X}", gemini);
    println!("ANTIGRAVITY: 0x{:08X}", antigravity);
    println!("KIMI:        0x{:08X}", kimi);
}
