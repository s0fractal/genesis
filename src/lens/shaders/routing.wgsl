// 🌌 OMEGA-64: Era 1000 — WGSL Phase Routing Primitives
//
// Integer-only hyperbolic distance and Taylor step for GPU-side routing.
// Matches Rust `omega_v2/src/routing.rs` bit-for-bit.

/// Decode consensus byte from a PhaseAddress.
fn routing_consensus(addr: u32) -> u32 {
    return (addr >> 24u) & 0xFFu;
}

/// Decode social byte from a PhaseAddress.
fn routing_social(addr: u32) -> u32 {
    return (addr >> 16u) & 0xFFu;
}

/// Decode personal byte from a PhaseAddress.
fn routing_personal(addr: u32) -> u32 {
    return (addr >> 8u) & 0xFFu;
}

/// Decode micro byte from a PhaseAddress.
fn routing_micro(addr: u32) -> u32 {
    return addr & 0xFFu;
}

/// Encode four bytes into a PhaseAddress.
fn routing_encode(c: u32, s: u32, p: u32, m: u32) -> u32 {
    return ((c & 0xFFu) << 24u) |
           ((s & 0xFFu) << 16u) |
           ((p & 0xFFu) << 8u)  |
           (m & 0xFFu);
}

/// Hyperbolic distance between two PhaseAddresses (scaled ×8).
/// Divide by 8 to get the true distance.
fn routing_hyperbolic_distance_scaled(a_raw: u32, a_ortho: u32, b_raw: u32, b_ortho: u32) -> u32 {
    let dc = abs(routing_consensus(a_raw) - routing_consensus(b_raw));
    let ds = abs(routing_social(a_raw)    - routing_social(b_raw));
    let dp = abs(routing_personal(a_raw)  - routing_personal(b_raw));
    let dm = abs(routing_micro(a_raw)     - routing_micro(b_raw));
    let do_ = abs(a_ortho - b_ortho);
    return dc * 8u + ds * 4u + dp * 2u + dm + do_ * 16u;
}

/// Toroidal hyperbolic distance (consensus wraps at 256).
fn routing_hyperbolic_distance_toroidal_scaled(a_raw: u32, a_ortho: u32, b_raw: u32, b_ortho: u32) -> u32 {
    let raw_dc = abs(routing_consensus(a_raw) - routing_consensus(b_raw));
    let dc = min(raw_dc, 256u - raw_dc);
    let ds = abs(routing_social(a_raw)    - routing_social(b_raw));
    let dp = abs(routing_personal(a_raw)  - routing_personal(b_raw));
    let dm = abs(routing_micro(a_raw)     - routing_micro(b_raw));
    let do_ = abs(a_ortho - b_ortho);
    return dc * 8u + ds * 4u + dp * 2u + dm + do_ * 16u;
}

struct PhaseAddressWGSL {
    raw: u32,
    ortho: u32,
}

/// First-order Taylor step toward target, clamped to max_step per level.
fn routing_taylor_step(src_raw: u32, src_ortho: u32, dst_raw: u32, dst_ortho: u32, max_step: u32) -> PhaseAddressWGSL {
    let step = |a: u32, b: u32| -> u32 {
        let delta = i32(b) - i32(a);
        var clamped = delta;
        if (delta > i32(max_step)) { clamped = i32(max_step); }
        if (delta < -i32(max_step)) { clamped = -i32(max_step); }
        return u32(i32(a) + clamped);
    };
    let c = step(routing_consensus(src_raw), routing_consensus(dst_raw));
    let s = step(routing_social(src_raw),    routing_social(dst_raw));
    let p = step(routing_personal(src_raw),  routing_personal(dst_raw));
    let m = step(routing_micro(src_raw),     routing_micro(dst_raw));
    let o = step(src_ortho, dst_ortho);
    return PhaseAddressWGSL(routing_encode(c, s, p, m), o);
}

/// Greedy next-hop selection among up to 8 neighbours.
fn routing_greedy_next_hop(
    self_raw: u32,
    self_ortho: u32,
    target_raw: u32,
    target_ortho: u32,
    neighbours_raw: ptr<function, array<u32, 8>>,
    neighbours_ortho: ptr<function, array<u32, 8>>,
    neighbour_count: u32,
) -> PhaseAddressWGSL {
    let self_dist = routing_hyperbolic_distance_scaled(self_raw, self_ortho, target_raw, target_ortho);
    var best_raw = self_raw;
    var best_ortho = self_ortho;
    var best_dist = self_dist;
    for (var i = 0u; i < neighbour_count; i = i + 1u) {
        let n_raw = (*neighbours_raw)[i];
        let n_ortho = (*neighbours_ortho)[i];
        let d = routing_hyperbolic_distance_scaled(n_raw, n_ortho, target_raw, target_ortho);
        if (d < best_dist) {
            best_dist = d;
            best_raw = n_raw;
            best_ortho = n_ortho;
        }
    }
    return PhaseAddressWGSL(best_raw, best_ortho);
}
