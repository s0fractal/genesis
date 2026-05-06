//! Φ-Маніфест: Multi-Anchor Temporal Layer (BTC + ETH + SOL)
//!
//! Кореневий шар захисту мережі. Кожен φ на кожному рівні похідний від:
//!   φ_child = mix(φ_parent, btc_hashes, eth_hashes, sol_hashes, child_id) mod 2^q_phase
//!
//! Забезпечує liveness: якщо одна мережа зупиняється, інші продовжують рухати φ.

/// Детерміністичний 64-бітний mixer (FNV-1a + xorshift finale).
/// Не криптографічно стійкий, але дає avalanche effect і побітову
/// детермінованість на всіх архітектурах (x86, ARM, RISC-V, WASM).
#[inline(always)]
fn mix_u64(state: u64, data: u64) -> u64 {
    let mut s = state ^ data;
    // FNV-1a style multiplication
    s = s.wrapping_mul(1099511628211);
    // xorshift finale для розмиття
    s ^= s << 13;
    s ^= s >> 7;
    s ^= s << 17;
    s
}

#[derive(Clone, Copy, Debug)]
pub struct AnchorState {
    pub block_hashes: [u64; 6],
    pub head: usize,
    pub total_blocks: u64,
}

impl Default for AnchorState {
    fn default() -> Self {
        Self::new()
    }
}

impl AnchorState {
    pub const fn new() -> Self {
        Self {
            block_hashes: [0; 6],
            head: 0,
            total_blocks: 0,
        }
    }
    
    pub fn init(&mut self, hashes: [u64; 6]) {
        self.block_hashes = hashes;
        self.head = 5;
        self.total_blocks = 6;
    }
    
    pub fn ingest_block(&mut self, hash: u64) {
        self.head = (self.head + 1) % 6;
        self.block_hashes[self.head] = hash;
        self.total_blocks = self.total_blocks.saturating_add(1);
    }
    
    pub fn mix_into(&self, mut s: u64) -> u64 {
        if self.total_blocks < 6 {
            let available = core::cmp::min(self.total_blocks as usize, 6);
            for i in 0..available {
                let idx = (self.head + 6 - i) % 6;
                s = mix_u64(s, self.block_hashes[idx]);
            }
        } else {
            // Ordered chronologically
            for i in 0..6 {
                let idx = (self.head + 6 - 5 + i) % 6;
                s = mix_u64(s, self.block_hashes[idx]);
            }
        }
        s
    }
}

/// Multi-Anchor Temporal Layer
/// Тримає вікно останніх блоків для BTC, ETH та SOL.
#[derive(Clone, Copy, Debug)]
pub struct PhiAnchorChain {
    pub btc: AnchorState,
    pub eth: AnchorState,
    pub sol: AnchorState,
}

impl PhiAnchorChain {
    pub const fn new() -> Self {
        Self {
            btc: AnchorState::new(),
            eth: AnchorState::new(),
            sol: AnchorState::new(),
        }
    }

    /// Backwards compatibility / default BTC init
    pub fn init(&mut self, hashes: [u64; 6]) {
        self.btc.init(hashes);
    }

    pub fn init_network(&mut self, network_id: u32, hashes: [u64; 6]) {
        match network_id {
            0 => self.btc.init(hashes),
            1 => self.eth.init(hashes),
            2 => self.sol.init(hashes),
            _ => {}
        }
    }

    /// Backwards compatibility (BTC only)
    pub fn ingest_block(&mut self, hash: u64) {
        self.btc.ingest_block(hash);
    }

    pub fn ingest_block_network(&mut self, network_id: u32, hash: u64) {
        match network_id {
            0 => self.btc.ingest_block(hash),
            1 => self.eth.ingest_block(hash),
            2 => self.sol.ingest_block(hash),
            _ => {}
        }
    }

    /// Повертає поточний глобальний φ (рівень q_phase = 0).
    pub fn global_phi(&self) -> u32 {
        let mut s = 0u64;
        s = self.btc.mix_into(s);
        s = self.eth.mix_into(s);
        s = self.sol.mix_into(s);
        s as u32
    }

    /// Обчислює зсув золотого кута залежно від кількості блоків.
    /// Використовує 64-бітну константу золотого перерізу для детермінізму.
    #[inline(always)]
    fn golden_angle_step(height: u64, q_phase: u32) -> u32 {
        if q_phase == 0 || q_phase > 31 {
            return 0;
        }
        // 0.6180339887498948482 * 2^64
        let golden_ratio_64: u64 = 0x9E3779B97F4A7C15;
        let step_64 = golden_ratio_64.wrapping_mul(height);
        // Зсуваємо так, щоб значення лягало в межі 0..2^q_phase
        (step_64 >> (64 - q_phase)) as u32
    }

    /// Генерує φ для дочірнього рівня ієрархії.
    pub fn derive_phi(&self, parent_phi: u32, child_id: u64, q_phase: u32) -> u32 {
        assert!(q_phase <= 10, "q_phase must be in [0, 10] per PHI_MANIFEST");
        let mut s = parent_phi as u64;
        s = self.btc.mix_into(s);
        s = self.eth.mix_into(s);
        s = self.sol.mix_into(s);
        s = mix_u64(s, child_id);
        
        let mut h = s as u32;
        let total_height = self.total_blocks_all();
        h = h.wrapping_add(Self::golden_angle_step(total_height, q_phase));
        
        let mask = (1u32 << q_phase) - 1;
        h & mask
    }

    pub fn verify_coherence(
        &self,
        claimed_phi: u32,
        parent_phi: u32,
        child_id: u64,
        q_phase: u32,
        tolerance: u32,
    ) -> bool {
        let expected = self.derive_phi(parent_phi, child_id, q_phase);
        let diff = claimed_phi.abs_diff(expected);
        diff <= tolerance
    }

    pub fn total_blocks_all(&self) -> u64 {
        self.btc.total_blocks + self.eth.total_blocks + self.sol.total_blocks
    }
}

impl Default for PhiAnchorChain {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_chain_has_zero_blocks() {
        let chain = PhiAnchorChain::new();
        assert_eq!(chain.total_blocks_all(), 0);
        assert_eq!(chain.global_phi(), 0);
    }

    #[test]
    fn test_single_network_init() {
        let mut chain = PhiAnchorChain::new();
        chain.init_network(0, [1, 2, 3, 4, 5, 6]);
        assert_eq!(chain.total_blocks_all(), 6);
        assert_ne!(chain.global_phi(), 0);
    }

    #[test]
    fn test_multi_network_mix() {
        let mut chain1 = PhiAnchorChain::new();
        chain1.init_network(0, [1, 2, 3, 4, 5, 6]);
        let phi1 = chain1.global_phi();

        let mut chain2 = PhiAnchorChain::new();
        chain2.init_network(0, [1, 2, 3, 4, 5, 6]);
        chain2.init_network(1, [10, 20, 30, 40, 50, 60]);
        let phi2 = chain2.global_phi();

        assert_ne!(phi1, phi2); // Mixing ETH changes phi
        
        // Even if SOL is empty, it shouldn't crash
        chain2.ingest_block_network(2, 999);
        assert_ne!(chain2.global_phi(), phi2);
    }

    #[test]
    fn test_golden_angle_step() {
        let step_0 = PhiAnchorChain::golden_angle_step(0, 10);
        assert_eq!(step_0, 0);

        let step_1 = PhiAnchorChain::golden_angle_step(1, 10);
        // 0x9E3779B97F4A7C15 >> 54 is exactly 632.
        // Let's verify: 0x9E3779B97F4A7C15 = 11400714819323198485.
        // 11400714819323198485 / 2^54 = 632.9. So it's 632.
        assert_eq!(step_1, 632);

        let step_2 = PhiAnchorChain::golden_angle_step(2, 10);
        // (632 * 2) % 1024 = 1264 % 1024 = 240. The precise wrapped 64-bit math gives 241.
        assert_eq!(step_2, 241);
    }

    #[test]
    fn test_derive_phi_includes_golden_spiral() {
        let mut chain1 = PhiAnchorChain::new();
        let p1 = chain1.derive_phi(123, 456, 10);

        chain1.ingest_block_network(0, 111);
        let p2 = chain1.derive_phi(123, 456, 10);

        // p1 and p2 must be different because total_blocks changed
        // and the base hash also changed (block ingested).
        assert_ne!(p1, p2);
    }
}
