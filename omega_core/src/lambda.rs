use generational_arena::{Arena, Index};
use std::collections::HashMap;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Combinator {
    S, K, I, Y, B, C, W,
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Term {
    Comb(Combinator),
    Var(String),
    App(Index, Index),
}

pub struct SimpleRng { pub state: u64 }
impl SimpleRng {
    pub fn next(&mut self) -> u32 {
        self.state = self.state.wrapping_mul(6364136223846793005).wrapping_add(1);
        (self.state >> 32) as u32
    }
}

pub struct LambdaArena {
    pub arena: Arena<Term>,
    pub parse_cache: HashMap<String, Index>,
}

impl Default for LambdaArena {
    fn default() -> Self {
        Self::new()
    }
}

impl LambdaArena {
    pub fn new() -> Self {
        Self {
            arena: Arena::with_capacity(100_000),
            parse_cache: HashMap::new(),
        }
    }

    pub fn alloc(&mut self, term: Term) -> Index {
        self.arena.insert(term)
    }

    pub fn apply(&mut self, left: Index, right: Index) -> Index {
        self.alloc(Term::App(left, right))
    }

    pub fn reduce_step(&mut self, root: Index) -> Option<Index> {
        let term = match self.arena.get(root) {
            Some(t) => t.clone(),
            None => return None,
        };

        if let Term::App(left_idx, right_idx) = term {
            let left_term = self.arena.get(left_idx).cloned();

            if let Some(Term::Comb(c)) = left_term {
                // I x => x
                if c == Combinator::I {
                    return Some(right_idx);
                }
                // Y x => x (Y x)
                if c == Combinator::Y {
                    let y_comb = self.alloc(Term::Comb(Combinator::Y));
                    let y_x = self.apply(y_comb, right_idx);
                    return Some(self.apply(right_idx, y_x));
                }
            }

            if let Some(Term::App(ll_idx, lr_idx)) = left_term {
                let ll_term = self.arena.get(ll_idx).cloned();

                // K x y => x
                if let Some(Term::Comb(Combinator::K)) = ll_term {
                    return Some(lr_idx); // x
                }

                // W x y => (x y) y
                if let Some(Term::Comb(Combinator::W)) = ll_term {
                    let x_y = self.apply(lr_idx, right_idx);
                    return Some(self.apply(x_y, right_idx));
                }

                if let Some(Term::App(lll_idx, llr_idx)) = ll_term {
                    let lll_term = self.arena.get(lll_idx).cloned();

                    // S x y z => (x z) (y z)
                    if let Some(Term::Comb(Combinator::S)) = lll_term {
                        let x = llr_idx;
                        let y = lr_idx;
                        let z = right_idx;
                        let x_z = self.apply(x, z);
                        let y_z = self.apply(y, z);
                        return Some(self.apply(x_z, y_z));
                    }

                    // B x y z => x (y z)
                    if let Some(Term::Comb(Combinator::B)) = lll_term {
                        let x = llr_idx;
                        let y = lr_idx;
                        let z = right_idx;
                        let y_z = self.apply(y, z);
                        return Some(self.apply(x, y_z));
                    }

                    // C x y z => x z y
                    if let Some(Term::Comb(Combinator::C)) = lll_term {
                        let x = llr_idx;
                        let y = lr_idx;
                        let z = right_idx;
                        let x_z = self.apply(x, z);
                        return Some(self.apply(x_z, y));
                    }
                }
            }

            // Attempt to reduce the left side of the application first (applicative order / strict)
            if let Some(reduced_left) = self.reduce_step(left_idx) {
                return Some(self.apply(reduced_left, right_idx));
            }

            // Attempt to reduce the right side if left is in normal form
            if let Some(reduced_right) = self.reduce_step(right_idx) {
                return Some(self.apply(left_idx, reduced_right));
            }
        }

        None
    }

    pub fn evaluate_fitness(&mut self, root: Index, max_steps: u32) -> (Index, u32, bool) {
        let mut current = root;
        let mut steps = 0;
        while steps < max_steps {
            if let Some(next) = self.reduce_step(current) {
                current = next;
                steps += 1;
            } else {
                return (current, steps, false);
            }
        }
        (current, steps, true)
    }

    
    pub fn reduce_step_stochastic(&mut self, root: Index, rng: &mut SimpleRng) -> Option<Index> {
        let term = match self.arena.get(root) {
            Some(t) => t.clone(),
            None => return None,
        };

        if rng.next() % 100 < 5 {
             if let Term::App(left_idx, right_idx) = term {
                 if let Some(reduced_left) = self.reduce_step_stochastic(left_idx, rng) {
                     return Some(self.apply(reduced_left, right_idx));
                 }
             }
        }

        if let Term::App(left_idx, right_idx) = term {
            let left_term = self.arena.get(left_idx).cloned();

            if let Some(Term::Comb(c)) = left_term {
                if c == Combinator::I { return Some(right_idx); }
                if c == Combinator::Y {
                    let y_comb = self.alloc(Term::Comb(Combinator::Y));
                    let y_x = self.apply(y_comb, right_idx);
                    return Some(self.apply(right_idx, y_x));
                }
            }

            if let Some(Term::App(ll_idx, lr_idx)) = left_term {
                let ll_term = self.arena.get(ll_idx).cloned();
                if let Some(Term::Comb(Combinator::K)) = ll_term { return Some(lr_idx); }
                if let Some(Term::Comb(Combinator::W)) = ll_term {
                    let x_y = self.apply(lr_idx, right_idx);
                    return Some(self.apply(x_y, right_idx));
                }

                if let Some(Term::App(lll_idx, llr_idx)) = ll_term {
                    let lll_term = self.arena.get(lll_idx).cloned();
                    if let Some(Term::Comb(Combinator::S)) = lll_term {
                        let x = llr_idx; let y = lr_idx; let z = right_idx;
                        let x_z = self.apply(x, z);
                        let y_z = self.apply(y, z);
                        return Some(self.apply(x_z, y_z));
                    }
                    if let Some(Term::Comb(Combinator::B)) = lll_term {
                        let x = llr_idx; let y = lr_idx; let z = right_idx;
                        let y_z = self.apply(y, z);
                        return Some(self.apply(x, y_z));
                    }
                    if let Some(Term::Comb(Combinator::C)) = lll_term {
                        let x = llr_idx; let y = lr_idx; let z = right_idx;
                        let x_z = self.apply(x, z);
                        return Some(self.apply(x_z, y));
                    }
                }
            }

            if let Some(reduced_left) = self.reduce_step_stochastic(left_idx, rng) {
                return Some(self.apply(reduced_left, right_idx));
            }
            if let Some(reduced_right) = self.reduce_step_stochastic(right_idx, rng) {
                return Some(self.apply(left_idx, reduced_right));
            }
        }
        None
    }

    pub fn evaluate_fitness_stochastic(&mut self, root: Index, max_steps: u32, entropy_seed: u32) -> (Index, u32, bool) {
        let mut current = root;
        let mut steps = 0;
        
        let root_u64 = root.into_raw_parts().0 as u64;
        let mut rng = SimpleRng { state: (entropy_seed as u64) ^ root_u64 ^ 0xDEADBEEFCAFEBABE };
        
        let jitter = (rng.next() % 21) as i32 - 10;
        let effective_max_steps = (max_steps as i32 + jitter).max(1) as u32;

        while steps < effective_max_steps {
            if let Some(next) = self.reduce_step_stochastic(current, &mut rng) {
                current = next;
                steps += 1;
            } else {
                return (current, steps, false);
            }
        }
        (current, steps, true)
    }

    pub fn measure_ir(&self, root: Index) -> (u32, u32, u32) { // (cost, depth, nodes)
        match self.arena.get(root) {
            Some(Term::Comb(_)) | Some(Term::Var(_)) => (1, 1, 1),
            Some(Term::App(left, right)) => {
                let (_, l_depth, l_nodes) = self.measure_ir(*left);
                let (_, r_depth, r_nodes) = self.measure_ir(*right);
                let nodes = 1 + l_nodes + r_nodes;
                let depth = 1 + l_depth.max(r_depth);
                let cost = nodes + (depth * 2);
                (cost, depth, nodes)
            }
            None => (0, 0, 0),
        }
    }

    pub fn decompose_ast(&self, root: Index) -> u32 {
        match self.arena.get(root) {
            Some(Term::Comb(_)) => 1,
            Some(Term::App(left, right)) => self.decompose_ast(*left) + self.decompose_ast(*right),
            _ => 0,
        }
    }

    pub fn phenotype_hue(&self, root: Index) -> u32 {
        let mut counts = [0u32; 6]; // S, K, I/Y, B, C, W
        self.walk_hue_counts(root, &mut counts);

        let total: u32 = counts.iter().sum();
        if total == 0 {
            return 42;
        }

        let total_f = total as f64;
        let s_ratio = counts[0] as f64 / total_f;
        let k_ratio = counts[1] as f64 / total_f;
        let i_ratio = counts[2] as f64 / total_f;
        let b_ratio = counts[3] as f64 / total_f;
        let c_ratio = counts[4] as f64 / total_f;
        let w_ratio = counts[5] as f64 / total_f;

        let pi = std::f64::consts::PI;
        let x = s_ratio * 0.0_f64.cos()
            + w_ratio * (pi / 3.0).cos()
            + k_ratio * (2.0 * pi / 3.0).cos()
            + i_ratio * (4.0 * pi / 3.0).cos()
            + b_ratio * (4.5 * pi / 3.0).cos()
            + c_ratio * (5.5 * pi / 3.0).cos();

        let y = s_ratio * 0.0_f64.sin()
            + w_ratio * (pi / 3.0).sin()
            + k_ratio * (2.0 * pi / 3.0).sin()
            + i_ratio * (4.0 * pi / 3.0).sin()
            + b_ratio * (4.5 * pi / 3.0).sin()
            + c_ratio * (5.5 * pi / 3.0).sin();

        let mut hue = y.atan2(x) * (180.0 / pi);
        if hue < 0.0 {
            hue += 360.0;
        }

        ((hue / 360.0) * 255.0).floor() as u32
    }

    fn walk_hue_counts(&self, root: Index, counts: &mut [u32; 6]) {
        if let Some(term) = self.arena.get(root) {
            match term {
                Term::Comb(Combinator::S) => counts[0] += 1,
                Term::Comb(Combinator::K) => counts[1] += 1,
                Term::Comb(Combinator::I) | Term::Comb(Combinator::Y) => counts[2] += 1,
                Term::Comb(Combinator::B) => counts[3] += 1,
                Term::Comb(Combinator::C) => counts[4] += 1,
                Term::Comb(Combinator::W) => counts[5] += 1,
                Term::App(left, right) => {
                    self.walk_hue_counts(*left, counts);
                    self.walk_hue_counts(*right, counts);
                }
                _ => {}
            }
        }
    }

    pub fn compile_morphology(&self, root: Index) -> u64 {
        let mut counts = [0u32; 6];
        self.walk_hue_counts(root, &mut counts);
        
        // S, K, I/Y, B, C, W
        let count_s = counts[0];
        let count_k = counts[1];
        let count_i = counts[2];
        let count_b = counts[3];
        let count_c = counts[4];
        let count_w = counts[5];

        let hue = self.phenotype_hue(root) as u64;
        let phase_shift = u64::min(255, ((count_i + count_b) * 32) as u64);
        let entanglement = u64::min(255, ((count_s + count_w) * 18) as u64);
        
        let (_, depth, nodes) = self.measure_ir(root);
        let amplitude = u64::min(255, (40 + nodes * 12) as u64);
        let lock = u64::min(255, ((count_k + count_c) * 24) as u64);

        let mut hash = 0u64;
        hash |= hue;
        hash |= phase_shift << 8;
        hash |= entanglement << 16;
        hash |= amplitude << 24;
        hash |= lock << 32;

        let variance = ((depth * 31337) & 0xFFFF) as u64;
        hash |= variance << 48;

        hash
    }

    pub fn decode_morphology(&mut self, genotype: u64) -> Index {
        // ... port random tree generation
        let phase_shift = ((genotype >> 8) & 0xFF) as u32;
        let entanglement = ((genotype >> 16) & 0xFF) as u32;
        let amplitude = ((genotype >> 24) & 0xFF) as u32;
        let lock = ((genotype >> 32) & 0xFF) as u32;
        let variance = ((genotype >> 48) & 0xFFFF) as u32;

        let count_iyb = phase_shift / 32;
        let count_sw = entanglement / 18;
        let count_kc = lock / 24;

        let mut total_nodes = std::cmp::max(40, amplitude).saturating_sub(40) / 12;
        if total_nodes < 1 { total_nodes = 1; }

        let mut pool = Vec::new();

        let mut seed = if variance == 0 { 1337 } else { variance };
        let mut rand = |max: u32| -> u32 {
            seed = seed.wrapping_mul(1103515245).wrapping_add(12345) & 0x7FFFFFFF;
            seed % std::cmp::max(1, max)
        };

        for _ in 0..count_sw { pool.push(self.alloc(Term::Comb(if rand(2) == 0 { Combinator::S } else { Combinator::W }))); }
        for _ in 0..count_kc { pool.push(self.alloc(Term::Comb(if rand(2) == 0 { Combinator::K } else { Combinator::C }))); }
        for _ in 0..count_iyb {
            let r = rand(3);
            pool.push(self.alloc(Term::Comb(if r == 0 { Combinator::I } else if r == 1 { Combinator::Y } else { Combinator::B })));
        }

        while pool.len() < total_nodes as usize {
            let choices = [Combinator::S, Combinator::K, Combinator::I, Combinator::Y, Combinator::B, Combinator::C, Combinator::W];
            pool.push(self.alloc(Term::Comb(choices[rand(7) as usize])));
        }

        // Fisher-Yates
        for i in (1..pool.len()).rev() {
            let j = rand((i + 1) as u32) as usize;
            pool.swap(i, j);
        }

        while pool.len() > 1 {
            if rand(10) > 4 && pool.len() >= 3 {
                let right = pool.pop().unwrap();
                let left = pool.pop().unwrap();
                let combined = self.apply(left, right);
                let idx = rand(pool.len() as u32) as usize;
                pool.insert(idx, combined);
            } else {
                let right = pool.pop().unwrap();
                let left = pool.pop().unwrap();
                let combined = self.apply(left, right);
                pool.push(combined);
            }
        }

        pool.pop().unwrap_or_else(|| self.alloc(Term::Comb(Combinator::I)))
    }

    pub fn format_term(&self, root: Index) -> String {
        match self.arena.get(root) {
            Some(Term::Comb(c)) => format!("{:?}", c),
            Some(Term::Var(v)) => v.clone(),
            Some(Term::App(left, right)) => {
                let left_str = self.format_term(*left);
                let right_str = self.format_term(*right);
                
                let l_needs_paren = matches!(self.arena.get(*left), Some(Term::App(_, _)));
                let r_needs_paren = matches!(self.arena.get(*right), Some(Term::App(_, _)));
                
                let l_tok = if l_needs_paren { format!("({})", left_str) } else { left_str };
                let r_tok = if r_needs_paren { format!("({})", right_str) } else { right_str };
                
                format!("{} {}", l_tok, r_tok)
            }
            None => "?".to_string(),
        }
    }

    pub fn parse_lambda(&mut self, input: &str) -> Index {
        let cache_key = input.trim().to_string();
        if let Some(&idx) = self.parse_cache.get(&cache_key) {
            return idx;
        }

        let replaced = cache_key.replace("(", " ( ").replace(")", " ) ");
        let mut tokens: Vec<&str> = replaced.split_whitespace().collect();

        let result = self.parse_tokens(&mut tokens);

        if self.parse_cache.len() > 10000 {
            self.parse_cache.clear();
        }
        self.parse_cache.insert(cache_key, result);

        result
    }

    fn parse_tokens(&mut self, tokens: &mut Vec<&str>) -> Index {
        if tokens.is_empty() {
            return self.alloc(Term::Comb(Combinator::I)); // fallback safely
        }

        let mut root = self.parse_single_token(tokens);

        while !tokens.is_empty() && tokens[0] != ")" {
            let next_term = self.parse_single_token(tokens);
            root = self.apply(root, next_term);
        }

        root
    }

    fn parse_single_token(&mut self, tokens: &mut Vec<&str>) -> Index {
        if tokens.is_empty() {
             return self.alloc(Term::Comb(Combinator::I));
        }

        let token = tokens.remove(0);

        if token == "(" {
            let mut left: Option<Index> = None;
            while !tokens.is_empty() && tokens[0] != ")" {
                let next_term = self.parse_single_token(tokens);
                left = Some(if let Some(l) = left {
                    self.apply(l, next_term)
                } else {
                    next_term
                });
            }
            if !tokens.is_empty() {
                tokens.remove(0); // consume ")"
            }
            left.unwrap_or_else(|| self.alloc(Term::Comb(Combinator::I)))
        } else if token == ")" {
            self.alloc(Term::Comb(Combinator::I)) // unexpected
        } else {
            match token {
                "S" => self.alloc(Term::Comb(Combinator::S)),
                "K" => self.alloc(Term::Comb(Combinator::K)),
                "I" => self.alloc(Term::Comb(Combinator::I)),
                "Y" => self.alloc(Term::Comb(Combinator::Y)),
                "B" => self.alloc(Term::Comb(Combinator::B)),
                "C" => self.alloc(Term::Comb(Combinator::C)),
                "W" => self.alloc(Term::Comb(Combinator::W)),
                "TRUE" => self.parse_lambda("K"),
                "FALSE" => self.parse_lambda("(K I)"),
                "NOT" => self.parse_lambda("(S (S I (K (K I))) (K K))"),
                "AND" => self.parse_lambda("(S S (K (K I)))"),
                "OR" => self.parse_lambda("(S I (K K))"),
                "CONS" => self.parse_lambda("(S (S I (K (S (K K) I))) (K I))"),
                "CAR" => self.parse_lambda("(S I (K K))"),
                "CDR" => self.parse_lambda("(S I (K (K I)))"),
                _ => self.alloc(Term::Var(token.to_string())),
            }
        }
    }
}
