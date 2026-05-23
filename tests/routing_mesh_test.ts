import { assertEquals } from "jsr:@std/assert";
import { PhaseRouter } from "../src/network/routing_bridge.ts";

/**
 * 3-node mesh routing simulation.
 * Verifies that greedy next-hop selection routes a plasmid from node A
 * through node B to node C using hyperbolic distance gradients.
 */
Deno.test("3-node mesh greedy routing A -> B -> C", async () => {
  // Node A at phase 0, B at 32, C at 64
  const nodeA = PhaseRouter.encode(0, 0, 0, 0);
  const nodeB = PhaseRouter.encode(32, 0, 0, 0);
  const nodeC = PhaseRouter.encode(64, 0, 0, 0);

  const router = new PhaseRouter(null);

  // From A, only neighbour is B. B is closer to C than A, so forward to B.
  const bestFromA = router.greedyNextHop(nodeA, nodeC, [nodeB]);
  assertEquals(bestFromA, nodeB, "A should forward to B");

  // From B, neighbours are A and C. C is the target / closer, so forward to C.
  const bestFromB = router.greedyNextHop(nodeB, nodeC, [nodeA, nodeC]);
  assertEquals(bestFromB, nodeC, "B should forward to C");

  // From C, neighbours are B. C is already the target (distance 0), so keep.
  const bestFromC = router.greedyNextHop(nodeC, nodeC, [nodeB]);
  assertEquals(bestFromC, nodeC, "C should keep the packet (self is target)");
});

/**
 * Toroidal wrap-around routing.
 * On a 1D ring, the shortest path from 0 to 224 goes backward through 224-256 wrap.
 */
Deno.test("toroidal 3-node mesh prefers wrap-around shortcut", async () => {
  const nodeA = PhaseRouter.encode(0, 0, 0, 0);
  const nodeB = PhaseRouter.encode(224, 0, 0, 0); // wraps to -32
  const nodeC = PhaseRouter.encode(192, 0, 0, 0); // target

  const router = new PhaseRouter(null);

  // Linear distance from A to C = 192 * 8 = 1536
  // Toroidal distance from A to C = min(192, 64) * 8 = 512
  // Distance from B to C = min(32, 224) * 8 = 256
  // So B is closer to C than A (256 < 512). Forward to B.
  const distAC = PhaseRouter.hyperbolicDistanceToroidalStatic(nodeA, nodeC);
  const distBC = PhaseRouter.hyperbolicDistanceToroidalStatic(nodeB, nodeC);
  assertEquals(distAC, 64 * 8);
  assertEquals(distBC, 32 * 8);

  const bestFromA = router.greedyNextHop(nodeA, nodeC, [nodeB]);
  assertEquals(bestFromA, nodeB, "A should forward to B for toroidal shortcut");
});
