pub mod phase_lattice;
pub mod granite;
pub mod constants;
pub mod utils;
pub mod lambda;

use wasm_bindgen::prelude::*;
use lambda::LambdaArena;
use generational_arena::Index;
use std::cell::RefCell;

thread_local! {
    static ARENA: RefCell<LambdaArena> = RefCell::new(LambdaArena::new());
    static INDEX_MAP: RefCell<Vec<Index>> = const { RefCell::new(Vec::new()) };
}

fn map_index(idx: Index) -> u32 {
    INDEX_MAP.with(|map: &RefCell<Vec<Index>>| {
        let mut m = map.borrow_mut();
        let pos = m.len();
        m.push(idx);
        pos as u32
    })
}

fn get_index(id: u32) -> Option<Index> {
    INDEX_MAP.with(|map: &RefCell<Vec<Index>>| map.borrow().get(id as usize).copied())
}

#[wasm_bindgen]
pub fn fnv1a_64(s: &str) -> u64 {
    let mut hash = crate::constants::FNV64_OFFSET_BASIS;
    for code_unit in s.encode_utf16() {
        hash = crate::constants::mix_u64(hash, code_unit as u64);
    }
    hash
}

#[wasm_bindgen]
pub fn lambda_parse(input: &str) -> u32 {
    ARENA.with(|arena| {
        let idx = arena.borrow_mut().parse_lambda(input);
        map_index(idx)
    })
}

#[wasm_bindgen]
pub fn lambda_evaluate_fitness(id: u32, max_steps: u32) -> Vec<u32> {
    if let Some(idx) = get_index(id) {
        ARENA.with(|arena| {
            let (result_idx, steps, timeout) = arena.borrow_mut().evaluate_fitness(idx, max_steps);
            vec![map_index(result_idx), steps, if timeout { 1 } else { 0 }]
        })
    } else {
        vec![id, 0, 0]
    }
}

#[wasm_bindgen]
pub fn lambda_measure_ir(id: u32) -> Vec<u32> {
    if let Some(idx) = get_index(id) {
        ARENA.with(|arena| {
            let (cost, depth, nodes) = arena.borrow().measure_ir(idx);
            vec![cost, depth, nodes]
        })
    } else {
        vec![0, 0, 0]
    }
}

#[wasm_bindgen]
pub fn lambda_decompose_ast(id: u32) -> u32 {
    if let Some(idx) = get_index(id) {
        ARENA.with(|arena| arena.borrow().decompose_ast(idx))
    } else {
        0
    }
}

#[wasm_bindgen]
pub fn lambda_compile_morphology(id: u32) -> u64 {
    if let Some(idx) = get_index(id) {
        ARENA.with(|arena| arena.borrow().compile_morphology(idx))
    } else {
        0
    }
}

#[wasm_bindgen]
pub fn lambda_decode_morphology(genotype: u64) -> u32 {
    ARENA.with(|arena| {
        let idx = arena.borrow_mut().decode_morphology(genotype);
        map_index(idx)
    })
}

#[wasm_bindgen]
pub fn lambda_phenotype_hue(id: u32) -> u32 {
    if let Some(idx) = get_index(id) {
        ARENA.with(|arena| arena.borrow().phenotype_hue(idx))
    } else {
        0
    }
}

#[wasm_bindgen]
pub fn lambda_format_term(id: u32) -> String {
    if let Some(idx) = get_index(id) {
        ARENA.with(|arena| arena.borrow().format_term(idx))
    } else {
        "?".to_string()
    }
}
