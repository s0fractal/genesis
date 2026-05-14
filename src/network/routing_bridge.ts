// Phase Routing Bridge (JS ↔ WASM FFI)

// Wraps the no_std Rust routing module (`omega_v2/src/routing.rs`) in a
// type-safe TypeScript API. All math is integer-only and deterministic.

export interface WasmExports {
    v2_route_address_from_agent_raw?: (index: number) => number;
    v2_route_address_from_agent_ortho?: (index: number) => number;
    v2_route_hyperbolic_distance?: (a_raw: number, a_ortho: number, b_raw: number, b_ortho: number) => number;
    v2_route_hyperbolic_distance_toroidal?: (a_raw: number, a_ortho: number, b_raw: number, b_ortho: number) => number;
    v2_route_hyperbolic_distance_3d?: (a_raw: number, a_ortho: number, tau_a: number, b_raw: number, b_ortho: number, tau_b: number) => number;
    v2_route_taylor_step_raw?: (src_raw: number, src_ortho: number, dst_raw: number, dst_ortho: number, maxStep: number) => number;
    v2_route_taylor_step_ortho?: (src_raw: number, src_ortho: number, dst_raw: number, dst_ortho: number, maxStep: number) => number;
    v2_route_taylor_step_curvature_raw?: (src_raw: number, src_ortho: number, dst_raw: number, dst_ortho: number, maxStep: number, curv_raw: number, curv_ortho: number) => number;
    v2_route_taylor_step_curvature_ortho?: (src_raw: number, src_ortho: number, dst_raw: number, dst_ortho: number, maxStep: number, curv_raw: number, curv_ortho: number) => number;
    v2_validate_dipole?: (matrix: number, inverse: number) => number;
    v2_set_attractor?: (index: number, matrix: number, inverse: number, pulseFreq: number, pulseAmp: number) => void;
    v2_clear_attractors?: () => void;
    // Senate FFI
    v2_senate_state_ptr?: () => number;
    v2_senate_hash?: (descPtr: number, descLen: number, outPtr: number) => void;
    v2_senate_propose?: (descPtr: number, descLen: number, proposerMatrix: number) => number;
    v2_senate_vote?: (hashPtr: number, aye: number, weight: number, ayeThreshold: number) => number;
    v2_senate_proposal_ayes?: (hashPtr: number) => number;
    v2_senate_is_accepted?: (hashPtr: number) => number;
    v2_senate_accepted_count?: () => number;
}

/**
 * 32-bit hierarchical phase address + 8-bit orthogonal deviation.
 * Layout: [consensus:8 | social:8 | personal:8 | micro:8] + ortho:8
 */
export type PhaseAddress = {
    raw: number;
    ortho: number;
};

export const NULL_ADDRESS: PhaseAddress = { raw: 0, ortho: 0 };

export class PhaseRouter {
    constructor(private wasm: WebAssembly.Instance | null) {}

    private get exports(): WasmExports {
        return (this.wasm?.exports as WasmExports) ?? {};
    }

    /**
     * Derive a PhaseAddress from the agent at `index`.
     * Returns 0 if the WASM module is not loaded or the index is out of bounds.
     */
    addressFromAgent(index: number): PhaseAddress {
        const fnRaw = this.exports.v2_route_address_from_agent_raw;
        const fnOrtho = this.exports.v2_route_address_from_agent_ortho;
        if (!fnRaw || !fnOrtho) return NULL_ADDRESS;
        return { raw: fnRaw(index), ortho: fnOrtho(index) };
    }

    /**
     * Hyperbolic distance between two PhaseAddresses (scaled ×8).
     * Divide by 8 to get the true distance.
     */
    hyperbolicDistance(a: PhaseAddress, b: PhaseAddress): number {
        const fn = this.exports.v2_route_hyperbolic_distance;
        if (!fn) return PhaseRouter.hyperbolicDistanceStatic(a, b);
        return fn(a.raw, a.ortho, b.raw, b.ortho);
    }

    /**
     * Toroidal hyperbolic distance (consensus wraps at 256). Scaled ×8.
     */
    hyperbolicDistanceToroidal(a: PhaseAddress, b: PhaseAddress): number {
        const fn = this.exports.v2_route_hyperbolic_distance_toroidal;
        if (!fn) return PhaseRouter.hyperbolicDistanceToroidalStatic(a, b);
        return fn(a.raw, a.ortho, b.raw, b.ortho);
    }

    /**
     * 3D Toroidal hyperbolic distance (with Time Curvature penalty). Scaled ×8.
     */
    hyperbolicDistanceToroidal3D(a: PhaseAddress, tauA: number, b: PhaseAddress, tauB: number): number {
        const fn = this.exports.v2_route_hyperbolic_distance_3d;
        if (!fn) {
            const baseDist = PhaseRouter.hyperbolicDistanceToroidalStatic(a, b);
            const tauDiff = Math.min(Math.abs(tauA - tauB), 64);
            const penalty = (tauDiff * 8) + Math.floor((tauDiff * tauDiff) / 1024);
            return baseDist + penalty;
        }
        return fn(a.raw, a.ortho, tauA, b.raw, b.ortho, tauB);
    }

    /**
     * Validate that matrix and inverse form a perfect dipole (bitwise complements).
     * Returns true if valid, false otherwise.
     */
    validateDipole(matrix: number, inverse: number): boolean {
        const fn = this.exports.v2_validate_dipole;
        if (!fn) {
            // Pure-JS fallback: XOR in JS is signed 32-bit, so we compare with -1
            // (0xFFFFFFFF signed) or use >>> 0 for unsigned.
            return (matrix ^ inverse) === -1;
        }
        return fn(matrix, inverse) !== 0;
    }

    /**
     * Pure-JS hyperbolic distance (no WASM required).
     * Matches Rust `PhaseAddress::hyperbolic_distance_scaled` exactly.
     */
    static hyperbolicDistanceStatic(a: PhaseAddress, b: PhaseAddress): number {
        const da = PhaseRouter.decode(a);
        const db = PhaseRouter.decode(b);
        const dc = Math.abs(da.consensus - db.consensus);
        const ds = Math.abs(da.social - db.social);
        const dp = Math.abs(da.personal - db.personal);
        const dm = Math.abs(da.micro - db.micro);
        const do_ = Math.abs(da.ortho - db.ortho);
        return dc * 8 + ds * 4 + dp * 2 + dm + do_ * 16;
    }

    /**
     * Pure-JS toroidal hyperbolic distance (consensus wraps at 256).
     * Matches Rust `PhaseAddress::hyperbolic_distance_toroidal_scaled`.
     */
    static hyperbolicDistanceToroidalStatic(a: PhaseAddress, b: PhaseAddress): number {
        const da = PhaseRouter.decode(a);
        const db = PhaseRouter.decode(b);
        const rawDc = Math.abs(da.consensus - db.consensus);
        const dc = Math.min(rawDc, 256 - rawDc);
        const ds = Math.abs(da.social - db.social);
        const dp = Math.abs(da.personal - db.personal);
        const dm = Math.abs(da.micro - db.micro);
        const do_ = Math.abs(da.ortho - db.ortho);
        return dc * 8 + ds * 4 + dp * 2 + dm + do_ * 16;
    }

    /**
     * Inject an attractor matrix into the WASM global attractor array.
     */
    setAttractor(index: number, matrix: number, inverse: number, pulseFreq: number, pulseAmp: number): void {
        const fn = this.exports.v2_set_attractor;
        if (!fn) return;
        fn(index, matrix, inverse, pulseFreq, pulseAmp);
    }

    /**
     * Clear all attractors from the WASM global array.
     */
    clearAttractors(): void {
        const fn = this.exports.v2_clear_attractors;
        if (!fn) return;
        fn();
    }

    /**
     * First-order Taylor step from `src` toward `dst`, clamped to `maxStep` per level.
     */
    taylorStep(src: PhaseAddress, dst: PhaseAddress, maxStep: number): PhaseAddress {
        const fnRaw = this.exports.v2_route_taylor_step_raw;
        const fnOrtho = this.exports.v2_route_taylor_step_ortho;
        if (!fnRaw || !fnOrtho) return src;
        return {
            raw: fnRaw(src.raw, src.ortho, dst.raw, dst.ortho, maxStep),
            ortho: fnOrtho(src.raw, src.ortho, dst.raw, dst.ortho, maxStep)
        };
    }

    /**
     * Second-order Taylor step with curvature vector `curv` (Q7 signed per byte).
     */
    taylorStepWithCurvature(
        src: PhaseAddress,
        dst: PhaseAddress,
        maxStep: number,
        curv: PhaseAddress,
    ): PhaseAddress {
        const fnRaw = this.exports.v2_route_taylor_step_curvature_raw;
        const fnOrtho = this.exports.v2_route_taylor_step_curvature_ortho;
        if (!fnRaw || !fnOrtho) return src;
        return {
            raw: fnRaw(src.raw, src.ortho, dst.raw, dst.ortho, maxStep, curv.raw, curv.ortho),
            ortho: fnOrtho(src.raw, src.ortho, dst.raw, dst.ortho, maxStep, curv.raw, curv.ortho)
        };
    }

    /**
     * Greedy next-hop selection among neighbour addresses.
     * Returns the raw PhaseAddress of the best neighbour, or `selfAddress` if
     * no neighbour is closer to the target (i.e., self is the destination).
     */
    greedyNextHop(
        selfAddress: PhaseAddress,
        targetAddress: PhaseAddress,
        neighbours: PhaseAddress[],
    ): PhaseAddress {
        let best = selfAddress;
        let bestDist = this.hyperbolicDistance(selfAddress, targetAddress);
        for (const n of neighbours) {
            const d = this.hyperbolicDistance(n, targetAddress);
            if (d < bestDist) {
                bestDist = d;
                best = n;
            }
        }
        return best;
    }

    /**
     * Decode a PhaseAddress into its four hierarchical levels.
     */
    static decode(addr: PhaseAddress): {
        consensus: number;
        social: number;
        personal: number;
        micro: number;
        ortho: number;
    } {
        return {
            consensus: (addr.raw >>> 24) & 0xFF,
            social: (addr.raw >>> 16) & 0xFF,
            personal: (addr.raw >>> 8) & 0xFF,
            micro: addr.raw & 0xFF,
            ortho: addr.ortho & 0xFF,
        };
    }

    /**
     * Encode four hierarchical levels into a PhaseAddress.
     */
    static encode(
        consensus: number,
        social: number,
        personal: number,
        micro: number,
        ortho: number = 0,
    ): PhaseAddress {
        const raw = ((consensus & 0xFF) << 24) |
            ((social & 0xFF) << 16) |
            ((personal & 0xFF) << 8) |
            (micro & 0xFF);
        return { raw: raw >>> 0, ortho: ortho & 0xFF };
    }
}
