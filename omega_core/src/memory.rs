use wasm_bindgen::prelude::*;

// The Struct of Arrays (SoA) Field holding the physics data for the ecosystem
#[wasm_bindgen]
#[repr(C)]
pub struct Field {
    pub width: u32,
    pub height: u32,
    pub(crate) x: Vec<i16>,
    pub(crate) y: Vec<i16>,
    pub(crate) theta_now: Vec<u8>,
    pub(crate) theta_f1: Vec<u8>,
    pub(crate) theta_f2: Vec<u8>,
    pub(crate) theta_f3: Vec<u8>,
    pub(crate) omega: Vec<u8>,
    pub(crate) energy: Vec<u8>,
    pub(crate) plasmids: Vec<u64>,
    pub(crate) hebbian_locks: Vec<u8>,
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
            theta_now: vec![0; size],
            theta_f1: vec![0; size],
            theta_f2: vec![0; size],
            theta_f3: vec![0; size],
            omega: vec![0; size],
            energy: vec![0; size],
            plasmids: vec![0; size],
            hebbian_locks: vec![0; size],
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
}
