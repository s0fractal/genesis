//! Φ-Маніфест: Bitcoin φ-Anchor Chain
//!
//! Кореневий шар захисту мережі. Кожен φ на кожному рівні похідний від:
//!   φ_child = mix(φ_parent, bitcoin_block_hashes[N-6..N], child_id) mod 2^q_phase
//!
//! Без живої Bitcoin-мережі неможливо згенерувати валідний φ.
//! Форк без coherence з мережею — мертвий шум.

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

/// Повільний, але ретельний mixer для 6 блоків + parent + child.
#[inline(always)]
fn mix_chain(parent_phi: u32, block_hashes: &[u64; 6], child_id: u64) -> u64 {
    let mut s = parent_phi as u64;
    for &h in block_hashes.iter() {
        s = mix_u64(s, h);
    }
    s = mix_u64(s, child_id);
    s
}

/// Bitcoin φ-Anchor Chain.
/// Тримає вікно останніх 6 блоків (~1 година = finality).
#[derive(Clone, Copy, Debug)]
pub struct PhiAnchorChain {
    /// Круговий буфер останніх 6 block hashes.
    pub block_hashes: [u64; 6],
    /// Індекс "голови" у круговому буфері (найновіший блок).
    pub head: usize,
    /// Лічильник всього отриманих блоків (для перевірки finality).
    pub total_blocks: u64,
}

impl PhiAnchorChain {
    pub const fn new() -> Self {
        Self {
            block_hashes: [0; 6],
            head: 0,
            total_blocks: 0,
        }
    }

    /// Ініціалізує якір початковими 6 хешами.
    /// Викликається один раз при bootstrap (наприклад, після синхронізації з Bitcoin node).
    pub fn init(&mut self, hashes: [u64; 6]) {
        self.block_hashes = hashes;
        self.head = 5;
        self.total_blocks = 6;
    }

    /// Інжектує новий Bitcoin block hash.
    /// Зсуває вікно: найстаріший випадає, найновіший додається.
    pub fn ingest_block(&mut self, hash: u64) {
        self.head = (self.head + 1) % 6;
        self.block_hashes[self.head] = hash;
        self.total_blocks = self.total_blocks.saturating_add(1);
    }

    /// Повертає поточний глобальний φ (рівень q_phase = 0).
    /// Це "heartbeat" всієї мережі.
    pub fn global_phi(&self) -> u32 {
        if self.total_blocks < 6 {
            // До finality — використовуємо тільки те, що є.
            // Робимо mix доступних блоків.
            let mut s = 0u64;
            let available = core::cmp::min(self.total_blocks as usize, 6);
            for i in 0..available {
                let idx = (self.head + 6 - i) % 6;
                s = mix_u64(s, self.block_hashes[idx]);
            }
            s as u32
        } else {
            mix_chain(0, &self.block_hashes, 0) as u32
        }
    }

    /// Генерує φ для дочірнього рівня ієрархії.
    ///
    /// # Аргументи
    /// * `parent_phi` — φ батьківського рівня.
    /// * `child_id`   — унікальний ідентифікатор дитини (node_id, agent_id, shard_id).
    /// * `q_phase`    — цільовий рівень роздільної здатності (0..=10).
    pub fn derive_phi(&self, parent_phi: u32, child_id: u64, q_phase: u32) -> u32 {
        assert!(q_phase <= 10, "q_phase must be in [0, 10] per PHI_MANIFEST");
        let raw = mix_chain(parent_phi, &self.block_hashes, child_id);
        let mask = (1u64 << q_phase) - 1;
        (raw & mask) as u32
    }

    /// Перевіряє, чи claimed_phi знаходиться в допустимому вікні coherence
    /// від очікуваного φ мережі.
    ///
    /// # Аргументи
    /// * `claimed_phi` — φ, який декларує чужа нода.
    /// * `parent_phi`  — φ батьківського рівня (для повторного обчислення).
    /// * `child_id`    — ідентифікатор чужої ноди.
    /// * `q_phase`     — рівень перевірки.
    /// * `tolerance`   — максимальна допустима відстань |claimed - expected|.
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

    /// Повертає snapshot 6 блоків у хронологічному порядку
    /// (найстаріший → найновіший), придатний для серіалізації.
    pub fn ordered_hashes(&self) -> [u64; 6] {
        let mut out = [0u64; 6];
        for (i, slot) in out.iter_mut().enumerate() {
            let src = (self.head + 6 - 5 + i) % 6;
            *slot = self.block_hashes[src];
        }
        out
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
        assert_eq!(chain.total_blocks, 0);
        assert_eq!(chain.global_phi(), 0);
    }

    #[test]
    fn test_init_and_global_phi() {
        let mut chain = PhiAnchorChain::new();
        chain.init([1, 2, 3, 4, 5, 6]);
        assert_eq!(chain.total_blocks, 6);
        let g1 = chain.global_phi();
        // Глобальний φ детермінований
        let g2 = chain.global_phi();
        assert_eq!(g1, g2);
        // Але не нульовий
        assert_ne!(g1, 0);
    }

    #[test]
    fn test_ingest_block_shifts_window() {
        let mut chain = PhiAnchorChain::new();
        chain.init([10, 20, 30, 40, 50, 60]);
        let phi_before = chain.global_phi();
        chain.ingest_block(99);
        let phi_after = chain.global_phi();
        // Новий блок має змінити глобальний φ
        assert_ne!(phi_before, phi_after);
    }

    #[test]
    fn test_derive_phi_determinism() {
        let mut chain = PhiAnchorChain::new();
        chain.init([0xDEAD, 0xBEEF, 0xCAFE, 0xBABE, 0xFACE, 0xFEED]);
        let p1 = chain.derive_phi(0, 42, 7);
        let p2 = chain.derive_phi(0, 42, 7);
        assert_eq!(p1, p2);
        // В межах mask 2^7 = 128
        assert!(p1 < 128);
    }

    #[test]
    fn test_derive_phi_hierarchy() {
        let mut chain = PhiAnchorChain::new();
        chain.init([1, 2, 3, 4, 5, 6]);

        // Level 0: глобальний
        let phi_0 = chain.global_phi();
        // Level 1: дочірній
        let phi_1_a = chain.derive_phi(phi_0, 0, 5);
        let phi_1_b = chain.derive_phi(phi_0, 1, 5);
        // Різні child_id → різні φ
        assert_ne!(phi_1_a, phi_1_b);

        // Level 2: онук
        let phi_2 = chain.derive_phi(phi_1_a, 100, 7);
        assert!(phi_2 < 128); // 2^7
    }

    #[test]
    fn test_verify_coherence_valid() {
        let mut chain = PhiAnchorChain::new();
        chain.init([7, 8, 9, 10, 11, 12]);
        let expected = chain.derive_phi(0, 77, 7);
        assert!(chain.verify_coherence(expected, 0, 77, 7, 0));
    }

    #[test]
    fn test_verify_coherence_invalid() {
        let mut chain = PhiAnchorChain::new();
        chain.init([7, 8, 9, 10, 11, 12]);
        let expected = chain.derive_phi(0, 77, 7);
        // Форк з іншим child_id дасть інший φ
        let fake = chain.derive_phi(0, 78, 7);
        assert!(!chain.verify_coherence(fake, 0, 77, 7, 0));
        // Але з достатнім tolerance — проходить (для демонстрації)
        let diff = expected.abs_diff(fake);
        assert!(chain.verify_coherence(fake, 0, 77, 7, diff));
    }

    #[test]
    fn test_ordered_hashes_length() {
        let mut chain = PhiAnchorChain::new();
        chain.init([10, 20, 30, 40, 50, 60]);
        chain.ingest_block(70);
        let ord = chain.ordered_hashes();
        // Останній елемент має бути найновішим (70)
        assert_eq!(ord[5], 70);
    }
}
