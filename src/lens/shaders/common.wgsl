// ==========================================
// DETERMINISTIC FIXED-POINT TRIGONOMETRY (Q10)
// ==========================================
// SINE_LUT is injected natively through JS to avoid payload duplication

fn sin(from_theta: u32, to_theta: u32) -> i32 {
    let index = (to_theta + 256u - from_theta) % 256u;
    return SINE_LUT[index];
}

fn cos(from_theta: u32, to_theta: u32) -> i32 {
    let index = (to_theta + 256u - from_theta + 64u) % 256u;
    return SINE_LUT[index];
}

fn q20_round(x: i32) -> i32 {
    if (x >= 0) {
        return (x + 524288) / 1048576;
    }
    return (x - 524288) / 1048576;
}

fn fast_abs(v: i32) -> i32 {
    let mask = v >> 31u;
    return (v ^ mask) - mask;
}
