use std::mem;

#[repr(C)]
#[derive(Clone, Copy)]
pub struct PhaseTopology {
    pub q_phase: u32,
    pub q_sectors: u32,
    pub q_radial: u32,
    pub q_math: u32,
    pub weather_multiplier: u32,
    pub _pad1: u32,
    pub _pad2: u32,
    pub _pad3: u32,
}

#[repr(C)]
pub struct SignalStore {
    pub dirty_flags: u32,
    pub absolute_tick: u32,
    pub active_agent_count: u32,
    pub max_cells: u32,
    pub _pad1: u32,
    pub _pad2: u32,
    pub _pad3: u32,
    pub _pad4: u32,
}

#[repr(C)]
pub struct PhaseLattice {
    pub topology: PhaseTopology,
    pub signals: SignalStore,
}

fn main() {
    let lattice: PhaseLattice = unsafe { mem::zeroed() };
    let ptr_lattice = &lattice as *const _ as usize;
    let ptr_active = &lattice.signals.active_agent_count as *const _ as usize;
    println!("active_agent_count offset: {}", ptr_active - ptr_lattice);
}
