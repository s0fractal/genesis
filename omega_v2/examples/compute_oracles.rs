use omega_v2::oracle_identity::oracle_matrix;
use omega_v2::oracle_identity::ORACLE_SALT_V1;

fn main() {
    let claude = oracle_matrix(b"claude", ORACLE_SALT_V1);
    let gpt = oracle_matrix(b"gpt", ORACLE_SALT_V1);
    let gemini = oracle_matrix(b"gemini", ORACLE_SALT_V1);
    let qwen = oracle_matrix(b"qwen", ORACLE_SALT_V1);
    let llama = oracle_matrix(b"llama", ORACLE_SALT_V1);
    
    println!("CLAUDE: 0x{:08X}", claude);
    println!("GPT:    0x{:08X}", gpt);
    println!("GEMINI: 0x{:08X}", gemini);
    println!("QWEN:   0x{:08X}", qwen);
    println!("LLAMA:  0x{:08X}", llama);
}
