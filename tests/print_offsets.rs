#[test]
fn print_offsets() {
    println!("PhaseTopology size: {}", std::mem::size_of::<omega_v2::topology::PhaseTopology>());
    println!("SignalStore size: {}", std::mem::size_of::<omega_v2::lattice::SignalStore>());
    println!("PhaseLattice size: {}", std::mem::size_of::<omega_v2::lattice::PhaseLattice>());
    println!("topology offset: {}", memoffset::offset_of!(omega_v2::lattice::PhaseLattice, topology));
    println!("signals offset: {}", memoffset::offset_of!(omega_v2::lattice::PhaseLattice, signals));
    println!("intents offset: {}", memoffset::offset_of!(omega_v2::lattice::PhaseLattice, intents));
}
