// Tests for reputation-aware greedy routing (routing_bridge.ts). greedyNextHop
// gains an optional reputation lens: forked/unreachable neighbours are gated out
// and unreliable ones take a distance detour, so a packet falls into a *reliable*
// phase well rather than the merely-nearest one (which may sit behind a hard NAT
// with no DCUtR hole). With no lens it stays the original pure phase-distance hop.

import { assertEquals } from "jsr:@std/assert@1";
import {
  type NeighborReliability,
  type PhaseAddress,
  PhaseRouter,
} from "../src/network/routing_bridge.ts";

// micro byte is distance weight 1 to the origin; WASM absent → static fallback.
const addr = (micro: number): PhaseAddress => ({ raw: micro >>> 0, ortho: 0 });
const TARGET = addr(0);
const SELF = addr(64); // far — never the answer when a neighbour is closer
const NEAR = addr(5); // phase-nearest
const FAR = addr(8); // farther but (in tests) more reliable

Deno.test("greedyNextHop: no reputation lens → original pure phase-distance hop", () => {
  const r = new PhaseRouter(null);
  assertEquals(r.greedyNextHop(SELF, TARGET, [NEAR, FAR]).raw, NEAR.raw);
});

Deno.test("greedyNextHop: ineligible (forked) neighbour is a hard gate — never picked", () => {
  const r = new PhaseRouter(null);
  const rep = (n: PhaseAddress): NeighborReliability =>
    n.raw === NEAR.raw
      ? { score: 999, eligible: false }
      : { score: 150, eligible: true };
  // NEAR is phase-nearest AND high-scoring, but ineligible → must pick FAR.
  assertEquals(r.greedyNextHop(SELF, TARGET, [NEAR, FAR], rep).raw, FAR.raw);
});

Deno.test("greedyNextHop: reliability detour flips a near-but-unreliable peer", () => {
  const r = new PhaseRouter(null);
  const rep = (n: PhaseAddress): NeighborReliability =>
    n.raw === NEAR.raw
      ? { score: 0, eligible: true }
      : { score: 150, eligible: true };
  // NEAR cost = 5 × 2.0 = 10; FAR cost = 8 × 1.0 = 8 → FAR wins.
  assertEquals(r.greedyNextHop(SELF, TARGET, [NEAR, FAR], rep).raw, FAR.raw);
});

Deno.test("greedyNextHop: a reliable nearest peer is still chosen (no needless detour)", () => {
  const r = new PhaseRouter(null);
  const rep = (_n: PhaseAddress): NeighborReliability => ({
    score: 150,
    eligible: true,
  });
  // both fully reliable → multiplier 1.0 for each → nearest (NEAR) wins as before.
  assertEquals(r.greedyNextHop(SELF, TARGET, [NEAR, FAR], rep).raw, NEAR.raw);
});

Deno.test("reliabilityMultiplier: full→1.0, zero→max detour, half→midpoint, clamped", () => {
  assertEquals(PhaseRouter.reliabilityMultiplier(150), 1.0);
  assertEquals(PhaseRouter.reliabilityMultiplier(0), 2.0);
  assertEquals(PhaseRouter.reliabilityMultiplier(75), 1.5);
  assertEquals(PhaseRouter.reliabilityMultiplier(300), 1.0); // over-full clamps
  assertEquals(PhaseRouter.reliabilityMultiplier(-50), 2.0); // negative clamps
});
