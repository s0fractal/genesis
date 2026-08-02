// 🌌 OMEGA-64: Era 1040 Phase 3 — SP1 STARK Prover
//
// Reads a MitosisReceipt from stdin (JSON), feeds it into the SP1 ZK guest
// in Mode 2, generates a STARK proof, verifies it locally, and emits the
// proof bundle as base64 JSON to stdout.
//
// Prover mode follows the SP1_PROVER env var (SP1's own convention):
//   cpu (DEFAULT) — real local STARK proof; no GPU, no network, no spend (slow).
//   mock          — fast development proof; NOT cryptographically sound.
//   network       — Succinct Prover Network (needs NETWORK_PRIVATE_KEY; paid).
//
// Usage:
//   echo '{"parent":...}' | omega_zk_host
//   omega_zk_host --self-test

use omega_v2::agent::PhaseAgentMinimal;
use omega_v2::attractor::AttractorArray;
use omega_v2::mitosis_proof::{child_receipt_hash, derive_mitosis_child};
use serde::{Deserialize, Serialize};
use sp1_sdk::blocking::{Elf, ProveRequest, Prover, ProverClient, SP1Stdin};
use sp1_sdk::HashableKey;
use sp1_sdk::ProvingKey;
use std::io::Read;
use base64::Engine;

const ELF_BYTES: &[u8] = include_bytes!(
    "../../target/elf-compilation/riscv64im-succinct-zkvm-elf/release/omega_zk_guest"
);

/// The active SP1 prover mode (`SP1_PROVER` env var; "cpu" by default — a real,
/// locally-generated STARK proof). Used to label the proof bundle honestly so the
/// `kind` field never claims more soundness than the prover that produced it.
fn prover_mode() -> String {
    std::env::var("SP1_PROVER").unwrap_or_else(|_| "cpu".to_string())
}

#[derive(Debug, Deserialize, Serialize)]
struct AgentJson {
    phase: u32,
    energy: u32,
    base_freq: i32,
    state_flags: u32,
    genome: u32,
    memory: [u32; 3],
}

#[derive(Debug, Deserialize, Serialize)]
struct AttractorJson {
    matrix: u32,
    inverse: u32,
    pulse_freq: u32,
    pulse_amp: u32,
}

#[derive(Debug, Deserialize, Serialize)]
struct MitosisReceiptJson {
    parent: AgentJson,
    child: AgentJson,
    attractors: Vec<AttractorJson>,
    #[serde(rename = "qPhase")]
    q_phase: u32,
    #[serde(rename = "receiptHash")]
    receipt_hash: String,
    #[serde(default)]
    tick: u32,
}

#[derive(Debug, Deserialize, Serialize)]
struct TickRollupJson {
    q_phase: u32,
    q_sectors: u32,
    q_radial: u32,
    q_math: u32,
    weather_multiplier: u32,
    /// Sakaguchi-Kuramoto phase lag. Part of the coupling LAW the proof
    /// binds; defaults to the canonical production value (64 ≈ 90°,
    /// cf. PhaseTopology::new) when omitted.
    #[serde(default = "default_alpha")]
    alpha: i32,
    active_count: u32,
    agents: Vec<AgentJson>,
    attractors: Vec<AttractorJson>,
}

fn default_alpha() -> i32 {
    omega_v2::constants::CANONICAL_PHASE_ALPHA
}

impl AgentJson {
    fn to_agent(&self) -> PhaseAgentMinimal {
        PhaseAgentMinimal {
            phase: self.phase,
            energy: self.energy,
            base_freq: self.base_freq,
            state_flags: self.state_flags,
            genome: self.genome,
            memory: self.memory,
        }
    }

    fn from_agent(a: &PhaseAgentMinimal) -> Self {
        Self {
            phase: a.phase,
            energy: a.energy,
            base_freq: a.base_freq,
            state_flags: a.state_flags,
            genome: a.genome,
            memory: a.memory,
        }
    }
}

/// Which PROGRAM a bundle attests, and under which physics law.
///
/// WHY THIS EXISTS (2026-08-02)
/// ---------------------------
/// The three bundles checked into `proofs/` stopped verifying the moment the
/// guest circuit changed (T3 made `alpha` a wire field). Measured: all three
/// fail with
///
///     verification failed: Core(invalid public values:
///     pc_start != vk.pc_start: program counter should start at vk.pc_start)
///
/// which is true, opaque, and blames the wrong thing. The proofs are not
/// corrupt; they attest a *different program*. Nothing in the bundle could say
/// so, because the only trace of the guest was a free-text note reading
/// "ELF 166400 bytes" — and a byte count is not an identity. (The current ELF
/// is 166736 bytes, which is how the drift was noticed at all, and a
/// same-length change would have left no trace whatsoever.)
///
/// So a bundle now carries the verifying-key hash and the SHA-256 of the exact
/// guest bytes, plus the physics parameters the proof is about. `--verify-only`
/// compares them BEFORE asking SP1 to verify, so program drift is reported as
/// program drift.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
struct ProgramCommitment {
    /// SP1 verifying-key hash (`HashableKey::bytes32`) — the circuit's identity.
    vkey: String,
    /// SHA-256 of the guest ELF, so a reader can check the artifact itself.
    elf_sha256: String,
    elf_bytes: usize,
}

/// The law the proof is about (V5.3). `alpha` is the Sakaguchi-Kuramoto phase
/// lag and is only meaningful for Mode 3 rollups, where the guest reads it from
/// the wire and commits it in the public values; `q_phase` is the quantisation.
/// Recorded as `Option` per field rather than invented for modes that do not
/// have them — a commitment to a value the proof never constrained would be
/// worse than none.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
struct PhysicsCommitment {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    alpha: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    q_phase: Option<u32>,
}

#[derive(Debug, Deserialize, Serialize)]
struct ProofBundle {
    kind: String,
    receipt_hash: String,
    parent_genome: String,
    verified: bool,
    proof_bytes: Option<String>,
    public_values: Option<String>,
    note: Option<String>,
    /// Absent in bundles generated before 2026-08-02. Absence is reported, never
    /// treated as a match: a bundle that cannot say which program it attests is
    /// exactly the case this field exists to end.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    program: Option<ProgramCommitment>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    physics: Option<PhysicsCommitment>,
}

fn self_test_receipt() -> MitosisReceiptJson {
    let parent = PhaseAgentMinimal {
        phase: 64,
        energy: 3000,
        base_freq: 7,
        state_flags: 0,
        genome: 0xCAFE_BABE,
        memory: [0xDEAD_BEEF, 1, 2],
    };
    let child = derive_mitosis_child(&parent, &AttractorArray::new(), 7);
    let receipt_hash = hex::encode(child_receipt_hash(&child));
    MitosisReceiptJson {
        parent: AgentJson::from_agent(&parent),
        child: AgentJson::from_agent(&child),
        attractors: vec![],
        q_phase: 7,
        receipt_hash,
        tick: 0,
    }
}

/// Build a valid, **non-canonical** Mode-2 receipt for proving an arbitrary
/// birth event (as opposed to `--self-test`'s fixed 0xCAFEBABE parent with no
/// attractors). This one uses a different parent genome/memory/energy **and**
/// one dominant attractor, so the derivation takes the `birth_near_attractor`
/// branch — exercising a part of the guest circuit the self-test never touches.
/// The child is derived by the same pure function the host and guest use, so
/// the receipt passes pre-flight and the guest by construction.
fn emit_receipt() -> MitosisReceiptJson {
    let parent = PhaseAgentMinimal {
        phase: 64,
        energy: 4200,
        base_freq: 5,
        state_flags: 0,
        genome: 0xA5A5_1234,
        memory: [0x0BAD_F00D, 7, 11],
    };
    let q_phase = 7u32;
    // Attractor whose phase (matrix & mask) sits on the parent's phase → dominates.
    let matrix = 64u32;
    let (inverse, pulse_freq, pulse_amp) = (!matrix, 3u32, 1000u32);
    let mut arr = AttractorArray::new();
    arr.set(0, omega_v2::attractor::AttractorMatrix::new(matrix, inverse, pulse_freq, pulse_amp));
    let child = derive_mitosis_child(&parent, &arr, q_phase);
    let receipt_hash = hex::encode(child_receipt_hash(&child));
    MitosisReceiptJson {
        parent: AgentJson::from_agent(&parent),
        child: AgentJson::from_agent(&child),
        attractors: vec![AttractorJson { matrix, inverse, pulse_freq, pulse_amp }],
        q_phase,
        receipt_hash,
        tick: 0,
    }
}

fn run(receipt: MitosisReceiptJson) -> Result<ProofBundle, String> {
    let parent = receipt.parent.to_agent();
    let claimed_child = receipt.child.to_agent();

    // Soft pre-flight: re-derive locally before bothering with SP1.
    let mut arr = AttractorArray::new();
    for (i, a) in receipt.attractors.iter().enumerate().take(4) {
        if (a.matrix ^ a.inverse) != 0xFFFF_FFFF {
            return Err(format!("attractor {} has invalid dipole", i));
        }
        arr.set(
            i,
            omega_v2::attractor::AttractorMatrix::new(a.matrix, a.inverse, a.pulse_freq, a.pulse_amp),
        );
    }
    let derived = derive_mitosis_child(&parent, &arr, receipt.q_phase);
    if derived.genome != claimed_child.genome
        || derived.phase != claimed_child.phase
        || derived.energy != claimed_child.energy
    {
        return Err("local pre-flight: claimed child does not match derivation".into());
    }
    let recomputed_hash = hex::encode(child_receipt_hash(&derived));
    if recomputed_hash != receipt.receipt_hash {
        return Err(format!(
            "local pre-flight: receipt hash mismatch (claimed=0x{}, computed=0x{})",
            receipt.receipt_hash, recomputed_hash
        ));
    }

    // Build SP1 stdin in the exact order the ZK guest's Mode 2 reads.
    let mut stdin = SP1Stdin::new();
    stdin.write::<u8>(&2u8); // mode
    stdin.write::<u32>(&receipt.q_phase);
    // parent (8 × u32 = 32 bytes)
    stdin.write::<u32>(&parent.phase);
    stdin.write::<u32>(&parent.energy);
    stdin.write::<i32>(&parent.base_freq);
    stdin.write::<u32>(&parent.state_flags);
    stdin.write::<u32>(&parent.genome);
    stdin.write::<u32>(&parent.memory[0]);
    stdin.write::<u32>(&parent.memory[1]);
    stdin.write::<u32>(&parent.memory[2]);
    // attractor count + entries
    stdin.write::<u32>(&(receipt.attractors.len() as u32));
    for a in &receipt.attractors {
        stdin.write::<u32>(&a.matrix);
        stdin.write::<u32>(&a.inverse);
        stdin.write::<u32>(&a.pulse_freq);
        stdin.write::<u32>(&a.pulse_amp);
    }
    // claimed child
    stdin.write::<u32>(&claimed_child.phase);
    stdin.write::<u32>(&claimed_child.energy);
    stdin.write::<i32>(&claimed_child.base_freq);
    stdin.write::<u32>(&claimed_child.state_flags);
    stdin.write::<u32>(&claimed_child.genome);
    stdin.write::<u32>(&claimed_child.memory[0]);
    stdin.write::<u32>(&claimed_child.memory[1]);
    stdin.write::<u32>(&claimed_child.memory[2]);

    // Real STARK proof under the default cpu mode (minutes, not ms); SP1_PROVER selects mode.
    eprintln!("[zk_host] Initialising SP1 prover client…");
    let prover = ProverClient::from_env(); // SP1_PROVER: cpu (default, real) | mock | network
    let elf = Elf::Static(ELF_BYTES);
    eprintln!("[zk_host] Setting up proving key from ELF ({} bytes)…", ELF_BYTES.len());
    let pk = prover.setup(elf).map_err(|e| format!("setup failed: {:?}", e))?;

    eprintln!("[zk_host] Generating STARK proof…");
    let proof = prover
        .prove(&pk, stdin)
        .run()
        .map_err(|e| format!("proof generation failed: {:?}", e))?;
    eprintln!("[zk_host] Proof generated. Verifying locally…");

    prover
        .verify(&proof, pk.verifying_key(), None)
        .map_err(|e| format!("local verification failed: {:?}", e))?;
    eprintln!("[zk_host] ✅ Verification succeeded.");

    // Serialize the proof for the JSON output.
    let proof_bytes = bincode::serialize(&proof)
        .map_err(|e| format!("proof serialization failed: {:?}", e))?;
    let public_values = bincode::serialize(&proof.public_values)
        .map_err(|e| format!("public values serialization failed: {:?}", e))?;

    Ok(ProofBundle {
        kind: format!("stark-{}", prover_mode()),
        receipt_hash: format!("0x{}", receipt.receipt_hash),
        parent_genome: format!("0x{:08x}", parent.genome),
        verified: true,
        proof_bytes: Some(base64::engine::general_purpose::STANDARD.encode(&proof_bytes)),
        public_values: Some(base64::engine::general_purpose::STANDARD.encode(&public_values)),
        note: Some(format!(
            "SP1 {} prover; ELF {} bytes; proof {} bytes",
            prover_mode(),
            ELF_BYTES.len(),
            proof_bytes.len()
        )),
        program: Some(local_program(pk.verifying_key())),
        // Mode 2 constrains the quantisation, not the coupling law: `alpha` is a
        // Mode 3 wire field and committing it here would claim the proof bounded
        // something it never saw.
        physics: Some(PhysicsCommitment { alpha: None, q_phase: Some(receipt.q_phase) }),
    })
}

fn run_rollup(rollup: TickRollupJson) -> Result<ProofBundle, String> {
    eprintln!("[zk_host_rollup] Initialising SP1 prover client for Mode 3…");
    let prover = ProverClient::from_env(); // SP1_PROVER: cpu (default, real) | mock | network
    let elf = Elf::Static(ELF_BYTES);
    let pk = prover.setup(elf).map_err(|e| format!("setup failed: {:?}", e))?;

    let mut stdin = SP1Stdin::new();
    // Mode 3: ZK Physics Rollup.
    // The mode byte MUST be u8: the guest reads exactly 1 byte
    // (sp1_zkvm::io::read::<u8>). Writing u32 here desynchronises the
    // entire stdin stream by 3 bytes.
    stdin.write::<u8>(&3u8);

    // Topology params (order must match the guest's Mode 3 reads exactly)
    stdin.write(&rollup.q_phase);
    stdin.write(&rollup.q_sectors);
    stdin.write(&rollup.q_radial);
    stdin.write(&rollup.q_math);
    stdin.write(&rollup.weather_multiplier);
    stdin.write::<i32>(&rollup.alpha);

    // Initial state
    stdin.write(&rollup.active_count);
    for a in &rollup.agents {
        stdin.write(&a.phase);
        stdin.write(&a.energy);
        stdin.write(&a.base_freq);
        stdin.write(&a.state_flags);
        stdin.write(&a.genome);
        stdin.write(&a.memory[0]);
        stdin.write(&a.memory[1]);
        stdin.write(&a.memory[2]);
    }

    // Attractors
    stdin.write(&(rollup.attractors.len() as u32));
    for a in &rollup.attractors {
        stdin.write(&a.matrix);
        stdin.write(&a.inverse);
        stdin.write(&a.pulse_freq);
        stdin.write(&a.pulse_amp);
    }

    eprintln!("[zk_host_rollup] Generating physics STARK proof for {} agents…", rollup.active_count);
    let proof = prover
        .prove(&pk, stdin)
        .run()
        .map_err(|e| format!("proving failed: {:?}", e))?;
    eprintln!("[zk_host_rollup] Proof generated. Verifying locally…");

    // Never report verified=true without actually verifying (honesty rule).
    prover
        .verify(&proof, pk.verifying_key(), None)
        .map_err(|e| format!("local verification failed: {:?}", e))?;
    eprintln!("[zk_host_rollup] ✅ Rollup STARK verified.");

    let proof_bytes = bincode::serialize(&proof)
        .map_err(|e| format!("proof serialization failed: {:?}", e))?;

    // Public values should contain initial_hash and final_hash
    let public_values = proof.public_values.to_vec();

    Ok(ProofBundle {
        kind: format!("stark-{}-rollup", prover_mode()),
        receipt_hash: "ROLLUP".to_string(), // Can be updated if needed
        parent_genome: "0x00000000".to_string(),
        verified: true,
        proof_bytes: Some(base64::engine::general_purpose::STANDARD.encode(&proof_bytes)),
        public_values: Some(base64::engine::general_purpose::STANDARD.encode(&public_values)),
        note: Some(format!(
            "SP1 {} rollup prover; {} agents; alpha={}",
            prover_mode(),
            rollup.active_count,
            rollup.alpha
        )),
        program: Some(local_program(pk.verifying_key())),
        physics: Some(PhysicsCommitment {
            alpha: Some(rollup.alpha),
            q_phase: Some(rollup.q_phase),
        }),
    })
}

/// The identity of the guest program THIS binary would verify against.
fn local_program(vk: &sp1_sdk::SP1VerifyingKey) -> ProgramCommitment {
    ProgramCommitment {
        vkey: vk.bytes32(),
        elf_sha256: hex::encode(omega_v2::crypto::sha256_hash(ELF_BYTES)),
        elf_bytes: ELF_BYTES.len(),
    }
}

fn run_verify_only(bundle: ProofBundle) -> Result<ProofBundle, String> {
    eprintln!("[zk_host] Initialising SP1 prover client for verification…");
    let prover = ProverClient::from_env(); // SP1_PROVER: cpu (default, real) | mock | network
    let elf = Elf::Static(ELF_BYTES);
    let pk = prover.setup(elf).map_err(|e| format!("setup failed: {:?}", e))?;

    // Program identity BEFORE the STARK check, so drift is named as drift. SP1's
    // own failure for this case is `pc_start != vk.pc_start`, which is accurate
    // and tells a reader nothing about which of the two artifacts moved.
    let local = local_program(pk.verifying_key());
    match &bundle.program {
        Some(claimed) if *claimed != local => {
            return Err(format!(
                "this bundle attests a DIFFERENT PROGRAM, so the proof cannot be \
                 checked here — it is not corrupt.\n  \
                 bundle : vkey {} / elf sha256 {} ({} bytes)\n  \
                 local  : vkey {} / elf sha256 {} ({} bytes)\n  \
                 Rebuild the guest from the commit that produced the bundle, or \
                 regenerate the bundle from this guest.",
                claimed.vkey, claimed.elf_sha256, claimed.elf_bytes,
                local.vkey, local.elf_sha256, local.elf_bytes
            ));
        }
        Some(_) => eprintln!("[zk_host] program commitment matches: vkey {}", local.vkey),
        None => eprintln!(
            "[zk_host] WARNING: this bundle predates program commitments (2026-08-02) \
             and cannot say which guest it attests. If verification fails below with \
             `pc_start != vk.pc_start`, the most likely cause is that the guest \
             changed, not that the proof is bad. Local guest: vkey {} / elf sha256 {}.",
            local.vkey, local.elf_sha256
        ),
    }

    let proof_bytes_b64 = bundle.proof_bytes.as_ref().ok_or("missing proof_bytes")?;
    let proof_bytes = base64::engine::general_purpose::STANDARD
        .decode(proof_bytes_b64)
        .map_err(|e| format!("base64 decode failed: {:?}", e))?;
    
    let proof: sp1_sdk::SP1ProofWithPublicValues = bincode::deserialize(&proof_bytes)
        .map_err(|e| format!("proof deserialization failed: {:?}", e))?;

    prover
        .verify(&proof, pk.verifying_key(), None)
        .map_err(|e| format!("verification failed: {:?}", e))?;

    eprintln!("[zk_host] ✅ Verification succeeded.");
    Ok(ProofBundle {
        kind: bundle.kind,
        receipt_hash: bundle.receipt_hash,
        parent_genome: bundle.parent_genome,
        verified: true,
        proof_bytes: Some(proof_bytes_b64.clone()),
        public_values: bundle.public_values,
        note: Some("Verified externally".into()),
        program: bundle.program,
        physics: bundle.physics,
    })
}

fn run_rollup_test() -> Result<ProofBundle, String> {
    // Generate a mock state for Mode 3 rollup test.
    let q_phase = 8u32;
    let active_count = 4u32;
    
    let topology = omega_v2::topology::PhaseTopology {
        q_phase,
        q_sectors: 1,
        q_radial: 1,
        q_math: 0,
        weather_multiplier: 1024,
        alpha: omega_v2::constants::CANONICAL_PHASE_ALPHA,
        _pad1: 0,
        _pad2: 0,
    };

    let mut snapshot = Vec::new();
    for i in 0..active_count {
        snapshot.push(PhaseAgentMinimal {
            phase: (i * 10) % 256,
            energy: 1000,
            base_freq: 5,
            state_flags: 0,
            genome: 0xAAAA_BBBB,
            memory: [0, 0, 0],
        });
    }

    // Build SP1 stdin
    let mut stdin = SP1Stdin::new();
    stdin.write::<u8>(&3u8); // Mode 3
    stdin.write::<u32>(&topology.q_phase);
    stdin.write::<u32>(&topology.q_sectors);
    stdin.write::<u32>(&topology.q_radial);
    stdin.write::<u32>(&topology.q_math);
    stdin.write::<u32>(&topology.weather_multiplier);
    stdin.write::<i32>(&topology.alpha);
    
    stdin.write::<u32>(&active_count);
    for agent in &snapshot {
        stdin.write::<u32>(&agent.phase);
        stdin.write::<u32>(&agent.energy);
        stdin.write::<i32>(&agent.base_freq);
        stdin.write::<u32>(&agent.state_flags);
        stdin.write::<u32>(&agent.genome);
        stdin.write::<u32>(&agent.memory[0]);
        stdin.write::<u32>(&agent.memory[1]);
        stdin.write::<u32>(&agent.memory[2]);
    }
    
    stdin.write::<u32>(&0u32); // attractor_count = 0

    eprintln!("[zk_host] Initialising SP1 prover client for Rollup Test…");
    let prover = ProverClient::from_env(); // SP1_PROVER: cpu (default, real) | mock | network
    let elf = Elf::Static(ELF_BYTES);
    let pk = prover.setup(elf).map_err(|e| format!("setup failed: {:?}", e))?;

    eprintln!("[zk_host] Generating STARK proof…");
    let proof = prover
        .prove(&pk, stdin)
        .run()
        .map_err(|e| format!("proof generation failed: {:?}", e))?;
    eprintln!("[zk_host] Proof generated. Verifying locally…");

    prover
        .verify(&proof, pk.verifying_key(), None)
        .map_err(|e| format!("local verification failed: {:?}", e))?;
    eprintln!("[zk_host] ✅ Verification succeeded.");

    let proof_bytes = bincode::serialize(&proof)
        .map_err(|e| format!("proof serialization failed: {:?}", e))?;
    let public_values = bincode::serialize(&proof.public_values)
        .map_err(|e| format!("public values serialization failed: {:?}", e))?;

    Ok(ProofBundle {
        kind: format!("stark-{}-rollup", prover_mode()),
        receipt_hash: "0x0".into(), // Or parse from public values if needed
        parent_genome: "0x0".into(),
        verified: true,
        proof_bytes: Some(base64::engine::general_purpose::STANDARD.encode(&proof_bytes)),
        public_values: Some(base64::engine::general_purpose::STANDARD.encode(&public_values)),
        note: Some(format!("SP1 Rollup {} prover; {} agents", prover_mode(), active_count)),
        program: Some(local_program(pk.verifying_key())),
        physics: Some(PhysicsCommitment {
            alpha: Some(topology.alpha),
            q_phase: Some(topology.q_phase),
        }),
    })
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    eprintln!(
        "[zk_host] SP1_PROVER={} — cpu is a REAL local STARK (~16 GB+ RAM, minutes); \
         set SP1_PROVER=mock for fast/unsound dev, or =network for Succinct.",
        prover_mode()
    );
    if args.iter().any(|a| a == "--rollup-test") {
        match run_rollup_test() {
            Ok(bundle) => {
                println!("{}", serde_json::to_string_pretty(&bundle).unwrap());
            }
            Err(e) => {
                eprintln!("[zk_host] FAILED: {}", e);
                std::process::exit(1);
            }
        }
        return;
    }

    if args.iter().any(|a| a == "--emit-receipt") {
        // Emit a valid non-canonical receipt JSON to stdout (pipe into a prover run).
        println!("{}", serde_json::to_string_pretty(&emit_receipt()).unwrap());
        return;
    }

    if args.iter().any(|a| a == "--verify-only") {
        let mut buf = String::new();
        std::io::stdin()
            .read_to_string(&mut buf)
            .expect("failed to read stdin");
        let bundle: ProofBundle = serde_json::from_str(&buf).expect("invalid proof bundle JSON");
        match run_verify_only(bundle) {
            Ok(res) => {
                println!("{}", serde_json::to_string_pretty(&res).unwrap());
            }
            Err(e) => {
                eprintln!("[zk_host] VERIFY FAILED: {}", e);
                std::process::exit(1);
            }
        }
        return;
    }

    if args.iter().any(|a| a == "--rollup") {
        let mut buf = String::new();
        std::io::stdin()
            .read_to_string(&mut buf)
            .expect("failed to read stdin");
        let rollup: TickRollupJson = serde_json::from_str(&buf).expect("invalid rollup JSON");
        match run_rollup(rollup) {
            Ok(res) => {
                println!("{}", serde_json::to_string_pretty(&res).unwrap());
            }
            Err(e) => {
                eprintln!("[zk_host] ROLLUP FAILED: {}", e);
                std::process::exit(1);
            }
        }
        return;
    }

    let receipt = if args.iter().any(|a| a == "--self-test") {
        self_test_receipt()
    } else {
        let mut buf = String::new();
        std::io::stdin()
            .read_to_string(&mut buf)
            .expect("failed to read stdin");
        serde_json::from_str(&buf).expect("invalid receipt JSON")
    };

    match run(receipt) {
        Ok(bundle) => {
            println!("{}", serde_json::to_string_pretty(&bundle).unwrap());
        }
        Err(e) => {
            eprintln!("[zk_host] FAILED: {}", e);
            std::process::exit(1);
        }
    }
}
