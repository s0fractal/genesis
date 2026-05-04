import { assertEquals } from "jsr:@std/assert";
import { PhaseRouter } from "../src/network/routing_bridge.ts";

Deno.test("PhaseRouter encode/decode roundtrip", async () => {
    const addr = PhaseRouter.encode(0xAB, 0xCD, 0xEF, 0x12);
    const decoded = PhaseRouter.decode(addr);
    assertEquals(decoded.consensus, 0xAB);
    assertEquals(decoded.social, 0xCD);
    assertEquals(decoded.personal, 0xEF);
    assertEquals(decoded.micro, 0x12);
});

Deno.test("PhaseRouter greedyNextHop prefers closer neighbour", async () => {
    // Self at (0,0,0,0), target at (100,0,0,0)
    const self = PhaseRouter.encode(0, 0, 0, 0);
    const target = PhaseRouter.encode(100, 0, 0, 0);
    // n0 at (10,0,0,0), n1 at (90,0,0,0) — n1 is closer
    const n0 = PhaseRouter.encode(10, 0, 0, 0);
    const n1 = PhaseRouter.encode(90, 0, 0, 0);

    const router = new PhaseRouter(null); // no WASM needed for pure JS greedyNextHop
    const best = router.greedyNextHop(self, target, [n0, n1]);
    assertEquals(best, n1);
});

Deno.test("PhaseRouter greedyNextHop returns self when no neighbour is closer", async () => {
    const self = PhaseRouter.encode(50, 0, 0, 0);
    const target = PhaseRouter.encode(50, 0, 0, 0); // target == self
    const n0 = PhaseRouter.encode(0, 0, 0, 0);
    const n1 = PhaseRouter.encode(100, 0, 0, 0);

    const router = new PhaseRouter(null);
    const best = router.greedyNextHop(self, target, [n0, n1]);
    assertEquals(best, self);
});

Deno.test("PhaseRouter greedyNextHop empty neighbours returns self", async () => {
    const self = PhaseRouter.encode(0, 0, 0, 0);
    const target = PhaseRouter.encode(100, 0, 0, 0);

    const router = new PhaseRouter(null);
    const best = router.greedyNextHop(self, target, []);
    assertEquals(best, self);
});

Deno.test("PhaseRouter hyperbolicDistance without WASM uses static fallback", async () => {
    const router = new PhaseRouter(null);
    const a = PhaseRouter.encode(10, 0, 0, 0);
    const b = PhaseRouter.encode(20, 0, 0, 0);
    const dist = router.hyperbolicDistance(a, b);
    // consensus diff = 10, weight = 8 → 80
    assertEquals(dist, 80);
});

Deno.test("PhaseRouter toroidal distance wraps consensus at 256", async () => {
    const a = PhaseRouter.encode(0, 0, 0, 0);
    const b = PhaseRouter.encode(224, 0, 0, 0);
    const linear = PhaseRouter.hyperbolicDistanceStatic(a, b);
    const toroidal = PhaseRouter.hyperbolicDistanceToroidalStatic(a, b);
    assertEquals(linear, 224 * 8);
    assertEquals(toroidal, 32 * 8);
});

Deno.test("PhaseRouter toroidal distance identical to linear for small gaps", async () => {
    const a = PhaseRouter.encode(0, 0, 0, 0);
    const b = PhaseRouter.encode(10, 0, 0, 0);
    assertEquals(
        PhaseRouter.hyperbolicDistanceStatic(a, b),
        PhaseRouter.hyperbolicDistanceToroidalStatic(a, b),
    );
});

Deno.test("PhaseRouter validateDipole without WASM uses JS fallback", async () => {
    const router = new PhaseRouter(null);
    assertEquals(router.validateDipole(0xDEADBEEF, ~0xDEADBEEF), true);
    assertEquals(router.validateDipole(0xDEADBEEF, 0xCAFEBABE), false);
});
