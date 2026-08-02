// FFI layout assertions — the zero-copy contract, made executable.
//
// JS reads WASM `.bss` memory through raw pointers (v2_bridge.ts
// getMemoryPointers) and parses structs BY BYTE OFFSET. Any drift between
// the Rust repr(C) layout and what JS/docs assume is a silent consensus
// failure. These tests fail the build the moment a layout changes, so a
// stale doc comment can never outlive the struct it describes (history:
// MitosisReceipt was documented as 160 bytes / u32 hash long after it grew
// to 192 bytes / SHA-256).

use core::mem::{align_of, offset_of, size_of};
use omega_v2::agent::PhaseAgentMinimal;
use omega_v2::attractor::{AttractorArray, AttractorMatrix};
use omega_v2::chronotopology::ProperTime;
use omega_v2::codeicide_law::{AgeHistogram, EnergyHistogram};
use omega_v2::cross_model_debate::DebateEntry;
use omega_v2::lattice::SignalStore;
use omega_v2::mitosis_log::{MitosisLog, MitosisReceipt, MITOSIS_LOG_CAPACITY};
use omega_v2::topology::PhaseTopology;
use omega_v2::warrant_issuance::WarrantProposal;

#[test]
fn phase_agent_minimal_is_32_bytes_gpu_coalesced() {
    assert_eq!(size_of::<PhaseAgentMinimal>(), 32, "32-byte GPU ABI broke");
    assert_eq!(
        align_of::<PhaseAgentMinimal>(),
        32,
        "align(32) is load-bearing"
    );
    // Field offsets per AGENTS.md §4.
    assert_eq!(offset_of!(PhaseAgentMinimal, phase), 0);
    assert_eq!(offset_of!(PhaseAgentMinimal, energy), 4);
    assert_eq!(offset_of!(PhaseAgentMinimal, base_freq), 8);
    assert_eq!(offset_of!(PhaseAgentMinimal, state_flags), 12);
    assert_eq!(offset_of!(PhaseAgentMinimal, genome), 16);
    assert_eq!(offset_of!(PhaseAgentMinimal, memory), 20);
}

#[test]
fn attractor_layout_matches_wgsl_uniform() {
    assert_eq!(size_of::<AttractorMatrix>(), 16);
    assert_eq!(size_of::<AttractorArray>(), 80, "count + pad + 4×16");
    assert_eq!(offset_of!(AttractorArray, data), 16);
}

#[test]
fn signal_store_is_48_bytes() {
    // WGSL SignalStore MUST match this exactly (both compute shaders).
    assert_eq!(size_of::<ProperTime>(), 12);
    assert_eq!(size_of::<SignalStore>(), 48);
    // Field offsets — JS readers address these absolutely from the lattice
    // head (signals at byte 32): v2_renderer.ts, v2_bridge.ts, v2.ts HUD.
    assert_eq!(offset_of!(SignalStore, dirty_flags), 0);
    assert_eq!(offset_of!(SignalStore, proper_time), 4);
    assert_eq!(offset_of!(ProperTime, causal_ticks), 0);
    assert_eq!(offset_of!(SignalStore, active_agent_count), 16);
    assert_eq!(offset_of!(SignalStore, max_cells), 20);
    assert_eq!(offset_of!(SignalStore, total_entropy_released), 24);
    assert_eq!(offset_of!(SignalStore, total_energy), 32);
    assert_eq!(offset_of!(SignalStore, p90_energy), 36);
    assert_eq!(offset_of!(SignalStore, p90_age), 40);
}

#[test]
fn mitosis_receipt_is_192_bytes_sha256_era() {
    // align(32) is inherited from the PhaseAgentMinimal fields, even though
    // the struct only asks for align(16).
    assert_eq!(align_of::<MitosisReceipt>(), 32);
    assert_eq!(
        size_of::<MitosisReceipt>(),
        192,
        "parent 32 + child 32 + attractors 80 + q_phase 4 + hash 32 + tick 4 + entropy 4 + cost 4"
    );
    assert_eq!(offset_of!(MitosisReceipt, receipt_hash), 148);
    // align(32) pushes `entries` past the 16-byte header to byte 32 — the
    // JS reader (mitosis_log_reader.ts MITOSIS_LOG_HEADER) MUST use 32.
    assert_eq!(offset_of!(MitosisLog, entries), 32);
    assert_eq!(
        size_of::<MitosisLog>(),
        32 + MITOSIS_LOG_CAPACITY * 192,
        "MitosisLog header(32, align-padded) + entries"
    );
}

#[test]
fn lattice_head_matches_js_uniform_window() {
    // v2_bridge.ts LATTICE_UNIFORM_SIZE = 208 bytes starting at
    // v2_lattice_ptr: topology(32) + signals(48) + intents(4×32).
    assert_eq!(offset_of!(omega_v2::lattice::PhaseLattice, signals), 32);
    assert_eq!(offset_of!(omega_v2::lattice::PhaseLattice, intents), 80);
    assert_eq!(
        offset_of!(omega_v2::lattice::PhaseLattice, intents)
            + 4 * size_of::<omega_v2::topology::OntologicalIntent>(),
        208
    );
}

#[test]
fn topology_is_32_bytes_two_vec4() {
    assert_eq!(size_of::<PhaseTopology>(), 32, "WebGPU vec4<u32> × 2");
}

#[test]
fn histogram_and_ledger_entry_sizes() {
    assert_eq!(size_of::<EnergyHistogram>(), 64);
    assert_eq!(size_of::<AgeHistogram>(), 64);
    assert_eq!(size_of::<DebateEntry>(), 32, "documented 32-byte entry");
    assert_eq!(
        size_of::<WarrantProposal>(),
        64,
        "12 bytes of fields + 4 status/pad + 4 raised_at + 32 escrow, align(8)"
    );
}
