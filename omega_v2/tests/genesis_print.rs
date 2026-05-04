// Helper test that prints the v1.0 Genesis Hash so we can anchor it
// across documentation and JS mirrors.
use omega_v2::genesis_inscription::{
    format_inscription, GENESIS_HASH_LEGACY_V1_0, PROTOCOL_VERSION,
};

#[test]
fn print_genesis_v1_0() {
    let s = format_inscription(GENESIS_HASH_LEGACY_V1_0);
    eprintln!("--- OMEGA-64 GENESIS INSCRIPTION v1.0 ---");
    eprintln!("Protocol:     {}", core::str::from_utf8(PROTOCOL_VERSION).unwrap());
    eprintln!("Genesis hash: 0x{:08x}", GENESIS_HASH_LEGACY_V1_0);
    eprintln!("OP_RETURN:    {}", core::str::from_utf8(&s).unwrap());
    eprintln!("-----------------------------------------");
}
