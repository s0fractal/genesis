// Unit tests for the T6 sync boundary guards (src/network/sync_recovery.ts).
//
// These lock two repairs made on 2026-08-01:
// 1. The divergence freeze is time-boxed — REQ_SNAPSHOT has no responder in
//    the codebase, so the old unconditional freeze halted local physics
//    forever (liveness failure, worse than divergence).
// 2. Xenobiological delta mutations are validated at the boundary — index in
//    bounds, energy ≤ MAX_ATP (Era 2080: energy is zero-sum except solar).
import { assertEquals } from "jsr:@std/assert";
import {
  DivergenceRecovery,
  MAX_ATP,
  MAX_MUTATIONS_PER_MESSAGE,
  sanitizeDeltaMutation,
  SNAPSHOT_FREEZE_TIMEOUT_MS,
} from "../src/network/sync_recovery.ts";

Deno.test("sanitize: valid mutation passes through unchanged", () => {
  const m = sanitizeDeltaMutation(5, 128, 2000, 0xDEADBEEF, 100);
  assertEquals(m, { index: 5, phase: 128, energy: 2000, genome: 0xDEADBEEF });
});

Deno.test("sanitize: out-of-bounds and negative indices are rejected", () => {
  assertEquals(sanitizeDeltaMutation(100, 0, 1, 0, 100), null);
  assertEquals(sanitizeDeltaMutation(-1, 0, 1, 0, 100), null);
  assertEquals(sanitizeDeltaMutation(2.5, 0, 1, 0, 100), null);
  // Boundary: last valid index passes.
  assertEquals(sanitizeDeltaMutation(99, 0, 1, 0, 100)?.index, 99);
});

Deno.test("sanitize: energy is clamped to MAX_ATP (no wire-minted ATP)", () => {
  const m = sanitizeDeltaMutation(0, 0, 0xFFFFFFFF, 0, 100);
  assertEquals(m?.energy, MAX_ATP);
  // Below the cap: untouched.
  assertEquals(
    sanitizeDeltaMutation(0, 0, MAX_ATP - 1, 0, 100)?.energy,
    MAX_ATP - 1,
  );
});

Deno.test("constants: MAX_ATP matches omega_v2/src/constants.rs", () => {
  assertEquals(MAX_ATP, 4096);
  assertEquals(MAX_MUTATIONS_PER_MESSAGE > 0, true);
  assertEquals(SNAPSHOT_FREEZE_TIMEOUT_MS > 0, true);
});

Deno.test("recovery: no freeze when we are the authority (remote <= local)", () => {
  const r = new DivergenceRecovery();
  assertEquals(r.onDivergence(0xBEEF, 0xBEEF, 1000), false);
  assertEquals(r.onDivergence(0xBEEF, 0xBEE0, 1000), false);
  assertEquals(r.isFrozen(1000), false);
  assertEquals(r.divergences, 0);
});

Deno.test("recovery: higher remote gt freezes exactly once per episode", () => {
  const r = new DivergenceRecovery();
  // Edge transition → caller publishes REQ_SNAPSHOT.
  assertEquals(r.onDivergence(0x1000, 0x2000, 1000), true);
  assertEquals(r.isFrozen(1001), true);
  assertEquals(r.waitingFor, 0x2000);
  // Same episode: no repeated edge.
  assertEquals(r.onDivergence(0x1000, 0x2000, 1002), false);
  assertEquals(r.divergences, 2);
});

Deno.test("recovery: freeze times out and never re-freezes the same gt (anti-flap)", () => {
  const r = new DivergenceRecovery();
  assertEquals(r.onDivergence(0x1000, 0x2000, 0), true);
  // Still frozen just before the deadline.
  assertEquals(r.isFrozen(SNAPSHOT_FREEZE_TIMEOUT_MS - 1), true);
  // Expired → released, gt remembered as exhausted.
  assertEquals(r.isFrozen(SNAPSHOT_FREEZE_TIMEOUT_MS), false);
  assertEquals(r.waitingFor, null);
  // The peer keeps broadcasting 0x2000 — no flap.
  assertEquals(
    r.onDivergence(0x1000, 0x2000, SNAPSHOT_FREEZE_TIMEOUT_MS + 1),
    false,
  );
  assertEquals(r.isFrozen(SNAPSHOT_FREEZE_TIMEOUT_MS + 1), false);
  // A NEW, different gt may freeze again.
  assertEquals(
    r.onDivergence(0x1000, 0x3000, SNAPSHOT_FREEZE_TIMEOUT_MS + 2),
    true,
  );
  assertEquals(r.isFrozen(SNAPSHOT_FREEZE_TIMEOUT_MS + 2), true);
});

Deno.test("recovery: applied snapshot resets the episode", () => {
  const r = new DivergenceRecovery();
  assertEquals(r.onDivergence(0x1000, 0x2000, 0), true);
  r.onSnapshotApplied();
  assertEquals(r.isFrozen(0), false);
  // After a real apply, the same gt pattern may freeze again (fresh state).
  assertEquals(r.onDivergence(0x2000, 0x2001, 10), true);
});
