use wasm_bindgen::prelude::*;

// The universe parameters
pub const W: usize = 256;
pub const H: usize = 256;
pub const SIZE: usize = W * H;

// The Struct of Arrays (SoA) Field holding the physics data for the ecosystem
#[wasm_bindgen]
#[repr(C)]
pub struct Field {
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
    pub fn new() -> Field {
        let mut f = Field {
            x: vec![0; SIZE],
            y: vec![0; SIZE],
            theta_now: vec![0; SIZE],
            theta_f1: vec![0; SIZE],
            theta_f2: vec![0; SIZE],
            theta_f3: vec![0; SIZE],
            omega: vec![0; SIZE],
            energy: vec![0; SIZE],
            plasmids: vec![0; SIZE],
            hebbian_locks: vec![0; SIZE],
        };

        // Initialize coordinates to a structured grid
        for i in 0..SIZE {
            f.x[i] = (i % W) as i16;
            f.y[i] = (i / W) as i16;
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
