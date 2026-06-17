// Philosophy Precedent System (Case Law)

/// Philosophy Precedent System (Case Law)
/// A historical record of a Senate vote that resulted in an ISSUED warrant.
#[derive(Clone, Copy, Debug)]
#[repr(C)]
pub struct SenatePrecedent {
    pub proposal_hash: u32,
    pub warrant_hash: u32,
    pub absolute_tick: u32,
    pub aye_bits: u8,
    pub _pad: [u8; 3], // align to 16 bytes
}

impl SenatePrecedent {
    pub const fn empty() -> Self {
        Self {
            proposal_hash: 0,
            warrant_hash: 0,
            absolute_tick: 0,
            aye_bits: 0,
            _pad: [0; 3],
        }
    }
}

/// A circular buffer of the last 256 precedents.
pub struct PrecedentLedger {
    pub cases: [SenatePrecedent; 256],
    pub head: u32,
}

impl Default for PrecedentLedger {
    fn default() -> Self {
        Self::new()
    }
}

impl PrecedentLedger {
    pub const fn new() -> Self {
        Self {
            cases: [SenatePrecedent::empty(); 256],
            head: 0,
        }
    }

    pub fn record(
        &mut self,
        proposal_hash: u32,
        warrant_hash: u32,
        absolute_tick: u32,
        aye_bits: u8,
    ) {
        let idx = (self.head % 256) as usize;
        self.cases[idx] = SenatePrecedent {
            proposal_hash,
            warrant_hash,
            absolute_tick,
            aye_bits,
            _pad: [0; 3],
        };
        self.head = self.head.wrapping_add(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_precedent_ledger_wraparound() {
        let mut ledger = PrecedentLedger::new();
        for i in 0..300 {
            ledger.record(i, i * 2, i * 10, 0b1111);
        }
        assert_eq!(ledger.head, 300);

        // 300 % 256 = 44, so index 43 should have been written last
        assert_eq!(ledger.cases[43].proposal_hash, 299);
        assert_eq!(ledger.cases[44].proposal_hash, 44); // overwritten from earlier loop? Wait, 44 was overwritten by 256+44 = 300, which is the 301st item. We inserted up to i=299.
                                                        // Wait, 299 % 256 = 43.
                                                        // So cases[43] is 299. cases[44] is 44!
    }
}
