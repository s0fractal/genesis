use wasm_bindgen::prelude::*;

// The Struct of Arrays (SoA) Field holding the physics data for the ecosystem
#[wasm_bindgen]
#[repr(C)]
pub struct Field {
    pub width: u32,
    pub height: u32,
    pub(crate) x: Vec<i16>,
    pub(crate) y: Vec<i16>,
    pub(crate) canary_1: u32,
    pub(crate) theta_now: Vec<u8>,
    pub(crate) theta_f1: Vec<u8>,
    pub(crate) theta_f2: Vec<u8>,
    pub(crate) theta_f3: Vec<u8>,
    pub(crate) canary_2: u32,
    pub(crate) omega: Vec<u8>,
    pub(crate) energy: Vec<u8>,
    pub(crate) canary_3: u32,
    pub(crate) plasmids: Vec<u64>,
    pub(crate) hebbian_locks: Vec<u8>,
    pub(crate) canary_4: u32,
    pub(crate) oracle_requests: Vec<u32>,
    pub oracle_request_count: usize,
    pub(crate) plasmid_collisions: Vec<u64>,
    pub collision_count: usize,
    pub(crate) cell_status: Vec<u8>,
    pub(crate) canary_end: u32,
}

#[wasm_bindgen]
impl Field {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> Field {
        let size = (width * height) as usize;
        let mut f = Field {
            width,
            height,
            x: vec![0; size],
            y: vec![0; size],
            canary_1: 0xDEADBEEF,
            theta_now: vec![0; size],
            theta_f1: vec![0; size],
            theta_f2: vec![0; size],
            theta_f3: vec![0; size],
            canary_2: 0xDEADBEEF,
            omega: vec![0; size],
            energy: vec![0; size],
            canary_3: 0xDEADBEEF,
            plasmids: vec![0; size],
            hebbian_locks: vec![0; size],
            canary_4: 0xDEADBEEF,
            oracle_requests: vec![0; 1024],
            oracle_request_count: 0,
            plasmid_collisions: vec![0; 1024 * 3],
            collision_count: 0,
            cell_status: vec![0; size],
            canary_end: 0xDEADBEEF,
        };

        // Initialize coordinates to a structured grid
        let w = width as usize;
        for i in 0..size {
            f.x[i] = (i % w) as i16;
            f.y[i] = (i / w) as i16;
            f.theta_now[i] = (i % 256) as u8; // Initial phase noise
        }
        f
    }

    // Export raw pointers to JS/WebGPU for zero-copy SharedArrayBuffer mapping
    pub fn ptr_x(&self) -> *const i16 { self.x.as_ptr() }
    pub fn ptr_y(&self) -> *const i16 { self.y.as_ptr() }
    pub fn ptr_theta_now(&self) -> *const u8 { self.theta_now.as_ptr() }
    pub fn ptr_theta_f1(&self) -> *const u8 { self.theta_f1.as_ptr() }
    pub fn ptr_theta_f2(&self) -> *const u8 { self.theta_f2.as_ptr() }
    pub fn ptr_theta_f3(&self) -> *const u8 { self.theta_f3.as_ptr() }
    pub fn ptr_omega(&self) -> *const u8 { self.omega.as_ptr() }
    pub fn ptr_energy(&self) -> *const u8 { self.energy.as_ptr() }
    pub fn ptr_plasmids(&self) -> *const u64 { self.plasmids.as_ptr() }
    pub fn ptr_hebbian_locks(&self) -> *const u8 { self.hebbian_locks.as_ptr() }
    
    // Oracle Zero-Copy Bindings
    pub fn ptr_oracle_requests(&self) -> *const u32 { self.oracle_requests.as_ptr() }
    pub fn get_oracle_request_count(&self) -> usize { self.oracle_request_count }
    pub fn clear_oracle_requests(&mut self) { self.oracle_request_count = 0; }
    pub fn ptr_cell_status(&mut self) -> *mut u8 { self.cell_status.as_mut_ptr() }
    
    pub fn ptr_plasmid_collisions(&self) -> *const u64 { self.plasmid_collisions.as_ptr() }
    pub fn get_collision_count(&self) -> usize { self.collision_count }
    pub fn clear_collisions(&mut self) { self.collision_count = 0; }
    
    // Status Enums
    pub fn status_idle() -> u8 { 0 }
    pub fn status_awaiting_oracle() -> u8 { 1 }
}
