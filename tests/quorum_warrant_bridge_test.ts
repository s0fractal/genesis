// Era 1540: Quorum-warrant bridge tests.
import { assertEquals, assert, assertThrows } from "jsr:@std/assert";
import {
    DEFAULT_BRIDGE_OPTS,
    QuorumWarrantBridge,
    WARRANT_BRIDGE_SCHEMA,
    buildWarrantDescription,
    senateHash,
} from "../src/network/quorum_warrant_bridge.ts";
import { TriggerOutcome } from "../src/network/quorum_investigation.ts";

const T0 = 1_000_000;

function outcome(fire: number[]): TriggerOutcome {
    return { fire_now: fire, pending: [], dissenter_count: fire.length };
}

Deno.test("buildWarrantDescription: deterministic + ≤64 chars", () => {
    const d = buildWarrantDescription(0xDEADBEEF, 0xCAFEBABE);
    assertEquals(d, "INV peer=0xdeadbeef consensus=0xcafebabe");
    assert(d.length <= 64);
});

Deno.test("senateHash: deterministic across calls", () => {
    const a = senateHash("INV peer=0xaaaaaaaa consensus=0xbbbbbbbb");
    const b = senateHash("INV peer=0xaaaaaaaa consensus=0xbbbbbbbb");
    assertEquals(a, b);
});

Deno.test("senateHash: different descriptions → different hashes", () => {
    const a = senateHash("INV peer=0xaaaaaaaa consensus=0x100");
    const b = senateHash("INV peer=0xbbbbbbbb consensus=0x100");
    assert(a !== b);
});

Deno.test("bridge: invalid opts throw", () => {
    assertThrows(() => new QuorumWarrantBridge({ dedup_window_ms: 0 }));
});

Deno.test("bridge: empty fire_now → empty payloads", () => {
    const b = new QuorumWarrantBridge();
    const result = b.issue(outcome([]), 0x100, T0);
    assertEquals(result.payloads, []);
    assertEquals(result.deduped_peer_ids, []);
});

Deno.test("bridge: single dissenter → one payload with valid hash", () => {
    const b = new QuorumWarrantBridge();
    const result = b.issue(outcome([0xFF]), 0x9299_32B5, T0);
    assertEquals(result.payloads.length, 1);
    const p = result.payloads[0];
    assertEquals(p.semanticType, "PROPOSAL");
    assertEquals(p.target_peer_id, 0xFF);
    assertEquals(p.issued_at_ms, T0);
    // Hash matches re-derivation.
    assertEquals(p.proposalHash, senateHash(p.proposalDescription));
});

Deno.test("bridge: multiple dissenters → multiple payloads", () => {
    const b = new QuorumWarrantBridge();
    const result = b.issue(outcome([0xFE, 0xFF]), 0x100, T0);
    assertEquals(result.payloads.length, 2);
    assertEquals(result.payloads.map(p => p.target_peer_id), [0xFE, 0xFF]);
});

Deno.test("bridge: dedup window blocks repeat issue for same peer", () => {
    const b = new QuorumWarrantBridge({ dedup_window_ms: 1000 });
    const r1 = b.issue(outcome([0xFF]), 0x100, T0);
    assertEquals(r1.payloads.length, 1);
    const r2 = b.issue(outcome([0xFF]), 0x100, T0 + 500);
    assertEquals(r2.payloads.length, 0);
    assertEquals(r2.deduped_peer_ids, [0xFF]);
});

Deno.test("bridge: dedup window elapsed → re-issue allowed", () => {
    const b = new QuorumWarrantBridge({ dedup_window_ms: 1000 });
    b.issue(outcome([0xFF]), 0x100, T0);
    const r2 = b.issue(outcome([0xFF]), 0x100, T0 + 1500);
    assertEquals(r2.payloads.length, 1);
});

Deno.test("bridge: forget clears dedup state", () => {
    const b = new QuorumWarrantBridge({ dedup_window_ms: 60_000 });
    b.issue(outcome([0xFF]), 0x100, T0);
    b.forget(0xFF);
    const r2 = b.issue(outcome([0xFF]), 0x100, T0 + 100);
    assertEquals(r2.payloads.length, 1);
});

Deno.test("bridge: different consensus anchors → distinct hashes for same peer", () => {
    const b = new QuorumWarrantBridge({ dedup_window_ms: 1 });
    const r1 = b.issue(outcome([0xAA]), 0x100, T0);
    const r2 = b.issue(outcome([0xAA]), 0x999, T0 + 100);
    assert(r1.payloads[0].proposalHash !== r2.payloads[0].proposalHash);
});

Deno.test("bridge: last_issued_snapshot sorted by peer_id", () => {
    const b = new QuorumWarrantBridge();
    b.issue(outcome([0xCC, 0xAA, 0xBB]), 0x100, T0);
    const snap = b.last_issued_snapshot();
    assertEquals(snap.map(s => s.peer_id), [0xAA, 0xBB, 0xCC]);
});

Deno.test("bridge: payloads carry deterministic description format", () => {
    const b = new QuorumWarrantBridge();
    const r = b.issue(outcome([0x1234_5678]), 0xDEAD_BEEF, T0);
    assertEquals(r.payloads[0].proposalDescription, "INV peer=0x12345678 consensus=0xdeadbeef");
});

Deno.test("schema constant", () => {
    assertEquals(WARRANT_BRIDGE_SCHEMA, "OMEGA-1540/v1");
});

Deno.test("integration: hash matches WebRTCV2Mesh.senateHash convention", async () => {
    // The bridge's senateHash MUST produce identical results to
    // the live mesh's static method so warrants flow through the
    // existing 3-of-5 oracle gate without re-validation drift.
    const { Libp2pMesh } = await import("../src/network/libp2p_mesh.ts");
    const desc = "INV peer=0xdeadbeef consensus=0xcafebabe";
    assertEquals(senateHash(desc), Libp2pMesh.senateHash(desc));
});
