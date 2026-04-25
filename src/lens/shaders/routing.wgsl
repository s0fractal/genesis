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
fn routing_hyperbolic_distance_scaled(a: u32, b: u32) -> u32 {
    let dc = abs(routing_consensus(a) - routing_consensus(b));
    let ds = abs(routing_social(a)    - routing_social(b));
    let dp = abs(routing_personal(a)  - routing_personal(b));
    let dm = abs(routing_micro(a)     - routing_micro(b));
    return dc * 8u + ds * 4u + dp * 2u + dm;
}

/// Toroidal hyperbolic distance (consensus wraps at 256).
fn routing_hyperbolic_distance_toroidal_scaled(a: u32, b: u32) -> u32 {
    let raw_dc = abs(routing_consensus(a) - routing_consensus(b));
    let dc = min(raw_dc, 256u - raw_dc);
    let ds = abs(routing_social(a)    - routing_social(b));
    let dp = abs(routing_personal(a)  - routing_personal(b));
    let dm = abs(routing_micro(a)     - routing_micro(b));
    return dc * 8u + ds * 4u + dp * 2u + dm;
}

/// First-order Taylor step toward target, clamped to max_step per level.
fn routing_taylor_step(src: u32, dst: u32, max_step: u32) -> u32 {
    let step = |a: u32, b: u32| -> u32 {
        let delta = i32(b) - i32(a);
        var clamped = delta;
        if (delta > i32(max_step)) { clamped = i32(max_step); }
        if (delta < -i32(max_step)) { clamped = -i32(max_step); }
        return u32(i32(a) + clamped);
    };
    let c = step(routing_consensus(src), routing_consensus(dst));
    let s = step(routing_social(src),    routing_social(dst));
    let p = step(routing_personal(src),  routing_personal(dst));
    let m = step(routing_micro(src),     routing_micro(dst));
    return routing_encode(c, s, p, m);
}

/// Greedy next-hop selection among up to 8 neighbours.
/// Returns the neighbour address with the smallest hyperbolic distance to target.
/// If no neighbour is closer than self, returns self (no forward needed).
fn routing_greedy_next_hop(
    self_addr: u32,
    target: u32,
    neighbours: ptr<function, array<u32, 8>>,
    neighbour_count: u32,
) -> u32 {
    let self_dist = routing_hyperbolic_distance_scaled(self_addr, target);
    var best_addr = self_addr;
    var best_dist = self_dist;
    for (var i = 0u; i < neighbour_count; i = i + 1u) {
        let n = (*neighbours)[i];
        let d = routing_hyperbolic_distance_scaled(n, target);
        if (d < best_dist) {
            best_dist = d;
            best_addr = n;
        }
    }
    return best_addr;
}
