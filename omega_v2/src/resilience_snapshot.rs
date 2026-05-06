// 🌌 OMEGA-64: Era 1190 — Resilience Snapshot Export
//
// Era 1180 measures `redundancy_rate` per-relay. Era 1190 lets each
// relay BROADCAST that measurement so peer relays can compare. Two
// relays agreeing on resilience metrics provide stronger evidence
// than either one alone — and disagreement reveals partitions.
//
// FRAME FORMAT (32 bytes, fits in a SporeFrame payload):
//
//   offset  size  field
//   ─────────────────────────────────────────────────────────────
//        0     2  magic = 0x5253 ("RS")
//        2     1  version (1 = OMEGA-64 v1.0)
//        3     1  reserved
//        4     4  total_intents       (u32 BE)
//        8     4  single_witness      (u32 BE)
//       12     4  double_witness      (u32 BE)
//       16     4  triple_plus         (u32 BE)
//       20     4  redundancy_rate_q16 (u32 BE; rate × 2^16)
//       24     4  proven_carrier_count (u32 BE)
//       28     4  sha256_crc           (BE; over bytes 0..28)
//
// `redundancy_rate_q16` is `(rate * 65536)` rounded; receivers
// recover the rate as `value / 65536.0`. Integer-only on the wire,
// floating-point only in the human-facing display.
//
// Snapshots are wrapped in a FRAME_TYPE_RESILIENCE_SNAPSHOT frame
// (added to spore_frame's enum) so they ride the same TTL/CRC/routing
// machinery as warrant votes and heartbeats.

use crate::crypto::sha256_u32;

pub const SNAPSHOT_BYTES: usize = 32;
pub const SNAPSHOT_MAGIC: u16 = 0x5253; // "RS"
pub const SNAPSHOT_VERSION_V1: u8 = 1;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(C, align(4))]
pub struct ResilienceSnapshot {
    pub magic: u16,
    pub version: u8,
    pub _reserved: u8,
    pub total_intents: u32,
    pub single_witness: u32,
    pub double_witness: u32,
    pub triple_plus: u32,
    /// rate × 2^16 (Q16 fixed-point)
    pub redundancy_rate_q16: u32,
    pub proven_carrier_count: u32,
    pub crc32: u32,
}

impl ResilienceSnapshot {
    pub const fn empty() -> Self {
        Self {
            magic: SNAPSHOT_MAGIC,
            version: SNAPSHOT_VERSION_V1,
            _reserved: 0,
            total_intents: 0,
            single_witness: 0,
            double_witness: 0,
            triple_plus: 0,
            redundancy_rate_q16: 0,
            proven_carrier_count: 0,
            crc32: 0,
        }
    }

    /// Build from raw counts. `redundancy_rate` is implied:
    /// `(double_witness / total_intents)` clamped to [0, 1].
    pub fn from_counts(
        total_intents: u32,
        single_witness: u32,
        double_witness: u32,
        triple_plus: u32,
        proven_carrier_count: u32,
    ) -> Self {
        let mut s = Self::empty();
        s.total_intents = total_intents;
        s.single_witness = single_witness;
        s.double_witness = double_witness;
        s.triple_plus = triple_plus;
        s.proven_carrier_count = proven_carrier_count;
        s.redundancy_rate_q16 = if total_intents == 0 {
            0
        } else {
            // Compute (double_witness * 65536 + total/2) / total
            // for round-to-nearest. Use u64 to avoid overflow.
            let scaled = (double_witness as u64).saturating_mul(65536);
            let half = (total_intents as u64) / 2;
            ((scaled + half) / (total_intents as u64)) as u32
        };
        s.crc32 = s.compute_crc();
        s
    }

    /// FNV-1a over bytes 0..28 (everything except the CRC slot).
    pub fn compute_crc(&self) -> u32 {
        let bytes = self.as_bytes();
        sha256_u32(&bytes[..28])
    }

    pub fn is_valid(&self) -> bool {
        self.magic == SNAPSHOT_MAGIC
            && self.version == SNAPSHOT_VERSION_V1
            && self.crc32 == self.compute_crc()
    }

    /// Serialize to 32 bytes in big-endian field order.
    pub fn as_bytes(&self) -> [u8; SNAPSHOT_BYTES] {
        let mut out = [0u8; SNAPSHOT_BYTES];
        out[0..2].copy_from_slice(&self.magic.to_be_bytes());
        out[2] = self.version;
        out[3] = self._reserved;
        out[4..8].copy_from_slice(&self.total_intents.to_be_bytes());
        out[8..12].copy_from_slice(&self.single_witness.to_be_bytes());
        out[12..16].copy_from_slice(&self.double_witness.to_be_bytes());
        out[16..20].copy_from_slice(&self.triple_plus.to_be_bytes());
        out[20..24].copy_from_slice(&self.redundancy_rate_q16.to_be_bytes());
        out[24..28].copy_from_slice(&self.proven_carrier_count.to_be_bytes());
        out[28..32].copy_from_slice(&self.crc32.to_be_bytes());
        out
    }

    pub fn from_bytes(buf: &[u8; SNAPSHOT_BYTES]) -> Option<Self> {
        let s = Self {
            magic: u16::from_be_bytes([buf[0], buf[1]]),
            version: buf[2],
            _reserved: buf[3],
            total_intents:        u32::from_be_bytes([buf[4],  buf[5],  buf[6],  buf[7]]),
            single_witness:       u32::from_be_bytes([buf[8],  buf[9],  buf[10], buf[11]]),
            double_witness:       u32::from_be_bytes([buf[12], buf[13], buf[14], buf[15]]),
            triple_plus:          u32::from_be_bytes([buf[16], buf[17], buf[18], buf[19]]),
            redundancy_rate_q16:  u32::from_be_bytes([buf[20], buf[21], buf[22], buf[23]]),
            proven_carrier_count: u32::from_be_bytes([buf[24], buf[25], buf[26], buf[27]]),
            crc32:                u32::from_be_bytes([buf[28], buf[29], buf[30], buf[31]]),
        };
        if s.is_valid() { Some(s) } else { None }
    }
}

/// Compare two snapshots and return the absolute difference in
/// redundancy_rate (Q16 units). Useful for partition detection: when
/// two relays observing the same mesh disagree by > THRESHOLD_Q16,
/// something has split the network.
pub fn redundancy_rate_diff_q16(a: &ResilienceSnapshot, b: &ResilienceSnapshot) -> u32 {
    a.redundancy_rate_q16.abs_diff(b.redundancy_rate_q16)
}

/// Threshold above which two relays' measurements indicate a partition.
/// 0.10 in Q16 ≈ 6553. Default operator alarm threshold.
pub const PARTITION_DIFF_THRESHOLD_Q16: u32 = 6553;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_is_exactly_32_bytes() {
        assert_eq!(core::mem::size_of::<ResilienceSnapshot>(), SNAPSHOT_BYTES);
    }

    #[test]
    fn round_trip_preserves_fields() {
        let s = ResilienceSnapshot::from_counts(100, 30, 60, 10, 25);
        let bytes = s.as_bytes();
        let parsed = ResilienceSnapshot::from_bytes(&bytes).expect("valid");
        assert_eq!(parsed, s);
        assert_eq!(parsed.total_intents, 100);
        assert_eq!(parsed.double_witness, 60);
    }

    #[test]
    fn redundancy_rate_q16_correct() {
        // 60/100 = 0.6 → 0.6 × 65536 = 39321.6 → 39322 (round-half-up)
        let s = ResilienceSnapshot::from_counts(100, 30, 60, 10, 0);
        assert_eq!(s.redundancy_rate_q16, 39322);
    }

    #[test]
    fn zero_total_yields_zero_rate() {
        let s = ResilienceSnapshot::from_counts(0, 0, 0, 0, 0);
        assert_eq!(s.redundancy_rate_q16, 0);
    }

    #[test]
    fn full_redundancy_yields_max_q16() {
        let s = ResilienceSnapshot::from_counts(100, 0, 100, 0, 50);
        // 100/100 = 1.0 → 1.0 × 65536 = 65536
        assert_eq!(s.redundancy_rate_q16, 65536);
    }

    #[test]
    fn corrupted_crc_rejected() {
        let s = ResilienceSnapshot::from_counts(100, 30, 60, 10, 25);
        let mut bytes = s.as_bytes();
        bytes[31] ^= 0x55;
        assert!(ResilienceSnapshot::from_bytes(&bytes).is_none());
    }

    #[test]
    fn wrong_magic_rejected() {
        let s = ResilienceSnapshot::from_counts(100, 30, 60, 10, 25);
        let mut bytes = s.as_bytes();
        bytes[0] = 0xAA;
        assert!(ResilienceSnapshot::from_bytes(&bytes).is_none());
    }

    #[test]
    fn wrong_version_rejected() {
        let s = ResilienceSnapshot::from_counts(100, 30, 60, 10, 25);
        let mut bytes = s.as_bytes();
        bytes[2] = 99;
        // CRC is computed before mutation → recompute is invalid → rejected.
        assert!(ResilienceSnapshot::from_bytes(&bytes).is_none());
    }

    #[test]
    fn diff_q16_symmetric() {
        let a = ResilienceSnapshot::from_counts(100, 30, 60, 10, 0);
        let b = ResilienceSnapshot::from_counts(100, 70, 20, 10, 0);
        let d1 = redundancy_rate_diff_q16(&a, &b);
        let d2 = redundancy_rate_diff_q16(&b, &a);
        assert_eq!(d1, d2);
        assert!(d1 > 0);
    }

    #[test]
    fn diff_zero_when_equal() {
        let s = ResilienceSnapshot::from_counts(100, 30, 60, 10, 0);
        assert_eq!(redundancy_rate_diff_q16(&s, &s), 0);
    }

    #[test]
    fn partition_threshold_makes_sense() {
        // 0.5 vs 0.6 → 0.1 difference → 6554 Q16 → above 6553 threshold.
        let a = ResilienceSnapshot::from_counts(100, 50, 50, 0, 0);
        let b = ResilienceSnapshot::from_counts(100, 40, 60, 0, 0);
        let diff = redundancy_rate_diff_q16(&a, &b);
        assert!(diff > 0);
        // 0.1 → 6554 Q16, threshold 6553 → triggers alarm.
        assert!(diff >= PARTITION_DIFF_THRESHOLD_Q16);
    }

    #[test]
    fn cross_lang_anchor_snapshot_crc() {
        // Frozen test vector for the JS port.
        let s = ResilienceSnapshot::from_counts(100, 30, 60, 10, 25);
        eprintln!("rust snapshot crc = 0x{:08x}", s.crc32);
        assert_eq!(s.crc32, 0xab42_2b98);
    }
}
