// 🌌 OMEGA-64: Era 1000 — Phase Routing Bridge (JS ↔ WASM FFI)
//
// Wraps the no_std Rust routing module (`omega_v2/src/routing.rs`) in a
// type-safe TypeScript API. All math is integer-only and deterministic.

export interface WasmExports {
    v2_route_address_from_agent?: (index: number) => number;
    v2_route_hyperbolic_distance?: (a: number, b: number) => number;
    v2_route_taylor_step?: (src: number, dst: number, maxStep: number) => number;
    v2_route_taylor_step_curvature?: (src: number, dst: number, maxStep: number, curv: number) => number;
}

/**
 * 32-bit hierarchical phase address.
 * Layout: [consensus:8 | social:8 | personal:8 | micro:8]
 */
export type PhaseAddress = number;

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
        const fn = this.exports.v2_route_address_from_agent;
        if (!fn) return 0;
        return fn(index);
    }

    /**
     * Hyperbolic distance between two PhaseAddresses (scaled ×8).
     * Divide by 8 to get the true distance.
     */
    hyperbolicDistance(a: PhaseAddress, b: PhaseAddress): number {
        const fn = this.exports.v2_route_hyperbolic_distance;
        if (!fn) return PhaseRouter.hyperbolicDistanceStatic(a, b);
        return fn(a, b);
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
        return dc * 8 + ds * 4 + dp * 2 + dm;
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
        return dc * 8 + ds * 4 + dp * 2 + dm;
    }

    /**
     * First-order Taylor step from `src` toward `dst`, clamped to `maxStep` per level.
     */
    taylorStep(src: PhaseAddress, dst: PhaseAddress, maxStep: number): PhaseAddress {
        const fn = this.exports.v2_route_taylor_step;
        if (!fn) return src;
        return fn(src, dst, maxStep);
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
        const fn = this.exports.v2_route_taylor_step_curvature;
        if (!fn) return src;
        return fn(src, dst, maxStep, curv);
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
    } {
        return {
            consensus: (addr >>> 24) & 0xFF,
            social: (addr >>> 16) & 0xFF,
            personal: (addr >>> 8) & 0xFF,
            micro: addr & 0xFF,
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
    ): PhaseAddress {
        return ((consensus & 0xFF) << 24) |
            ((social & 0xFF) << 16) |
            ((personal & 0xFF) << 8) |
            (micro & 0xFF);
    }
}
