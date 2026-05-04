// Era 1510: Mesh event bridge adapter tests.
import { assert, assertEquals } from "jsr:@std/assert";
import {
  decodeMeshPayload,
  decodeTranslationPolicyCorroborationMeshPayload,
  decodeTranslationPolicyMeshPayload,
  decodeTranslationPolicyReplayDigestDigestForensicReplayDigestMeshPayload,
  eventSyncPlasmidFields,
  MESH_BRIDGE_SCHEMA,
  MeshBridgeTransport,
  TranslationPolicyCorroborationMeshBridge,
  translationPolicyCorroborationPlasmidFields,
  TranslationPolicyMeshBridge,
  translationPolicyPlasmidFields,
  TranslationPolicyReplayDigestDigestForensicReplayDigestMeshBridge,
  translationPolicyReplayDigestDigestForensicReplayDigestPlasmidFields,
} from "../src/network/mesh_event_bridge.ts";
import {
  ForensicEvent,
  ForensicEventSink,
} from "../src/network/forensic_event_sink.ts";
import { SchemaTranslatorRegistry } from "../src/network/schema_translator.ts";
import { TranslationPolicyMonitor } from "../src/network/translation_policy/translation_policy_monitor.ts";
import {
  buildTranslationPolicyCorroborationRaise,
  TranslationPolicyCorroborationTracker,
} from "../src/network/translation_policy/translation_policy_corroboration.ts";
import {
  BridgeMessage,
  WebRTCEventBridge,
} from "../src/network/webrtc_event_bridge.ts";
import {
  TranslationPolicyReplayDigestDigestForensicReplayDigestClaim,
} from "../src/network/translation_policy/translation_policy_replay_digest_digest_forensic_replay_digest_claim.ts";

const T0 = 1_000_000;

const passthrough = (event: ForensicEvent) => event;

function policyRegistry(
  pairs: Array<[string, string]>,
): SchemaTranslatorRegistry {
  const r = new SchemaTranslatorRegistry();
  for (const [source, target] of pairs) r.register(source, target, passthrough);
  return r;
}

Deno.test("MeshBridgeTransport: forwards messages to emit callback", async () => {
  let captured_target: number | null = null;
  let captured_body: string | null = null;
  const emit = (peer: number, body: string) => {
    captured_target = peer;
    captured_body = body;
    return true;
  };
  const tx = new MeshBridgeTransport(emit);
  const ok = tx.send(0xBB, {
    kind: "PEER_HELLO",
    schema: "OMEGA-1500/v1",
    peer_id: 0xAA,
  });
  assert(ok);
  assertEquals(tx.sent_count, 1);
  assertEquals(captured_target, 0xBB);
  assert(captured_body !== null);
  const decoded = decodeMeshPayload(captured_body!);
  assertEquals(decoded?.kind, "PEER_HELLO");
});

Deno.test("MeshBridgeTransport: emit-failure propagates", async () => {
  const tx = new MeshBridgeTransport(() => false);
  const ok = tx.send(0xBB, {
    kind: "PEER_HELLO",
    schema: "OMEGA-1500/v1",
    peer_id: 0xAA,
  });
  assertEquals(ok, false);
  assertEquals(tx.sent_count, 0);
});

Deno.test("decodeMeshPayload: parses HELLO/HASH_LIST/DELTA shapes", async () => {
  const hello = JSON.stringify({
    kind: "PEER_HELLO",
    schema: "OMEGA-1500/v1",
    peer_id: 0xCC,
  });
  const list = JSON.stringify({
    kind: "HASH_LIST",
    from: 0xCC,
    list: {
      schema: "OMEGA-1390/v1",
      event_hashes: [],
      hash_set_anchor: 0,
      broadcast_at_ms: 0,
    },
  });
  const delta = JSON.stringify({
    kind: "DELTA",
    from: 0xCC,
    delta: {
      schema: "OMEGA-1390/v1",
      initiator_anchor: 0,
      missing_entries: [],
      peer_missing_hashes: [],
      delta_hash: 0,
      replied_at_ms: 0,
    },
  });
  assertEquals(decodeMeshPayload(hello)?.kind, "PEER_HELLO");
  assertEquals(decodeMeshPayload(list)?.kind, "HASH_LIST");
  assertEquals(decodeMeshPayload(delta)?.kind, "DELTA");
});

Deno.test("decodeMeshPayload: rejects unknown kind", async () => {
  const bad = JSON.stringify({ kind: "FUTURE", from: 0 });
  assertEquals(decodeMeshPayload(bad), null);
});

Deno.test("decodeMeshPayload: rejects malformed JSON", async () => {
  assertEquals(decodeMeshPayload("not json"), null);
  assertEquals(decodeMeshPayload(""), null);
  assertEquals(decodeMeshPayload("[]"), null);
});

Deno.test("decodeMeshPayload: rejects object without kind", async () => {
  assertEquals(decodeMeshPayload(JSON.stringify({ from: 0xAA })), null);
});

Deno.test("eventSyncPlasmidFields: produces target + body fields", async () => {
  const fields = eventSyncPlasmidFields(0xBB, {
    kind: "PEER_HELLO",
    schema: "OMEGA-1500/v1",
    peer_id: 0xAA,
  });
  assertEquals(fields.eventSyncTarget, 0xBB);
  const decoded = JSON.parse(fields.eventSyncBody);
  assertEquals(decoded.kind, "PEER_HELLO");
  assertEquals(decoded.peer_id, 0xAA);
});

Deno.test("decodeTranslationPolicyMeshPayload: parses policy claim", async () => {
  const monitor = new TranslationPolicyMonitor(
    0xAA,
    policyRegistry([
      ["alarms:v1.0", "alarms:v2.0"],
    ]),
  );
  const claim = monitor.localClaim(T0);
  const decoded = decodeTranslationPolicyMeshPayload(JSON.stringify(claim));
  assertEquals(decoded?.schema, "OMEGA-1650/v1");
  assertEquals(decoded?.peer_id, 0xAA);
  assertEquals(decoded?.pair_count, 1);
});

Deno.test("decodeTranslationPolicyMeshPayload: rejects malformed payloads", async () => {
  assertEquals(decodeTranslationPolicyMeshPayload("not json"), null);
  assertEquals(
    decodeTranslationPolicyMeshPayload(
      JSON.stringify({ schema: "OMEGA-1650/v1" }),
    ),
    null,
  );
  assertEquals(
    decodeTranslationPolicyMeshPayload(JSON.stringify({
      schema: "OMEGA-1650/v1",
      peer_id: 1,
      policy_hash: 2,
      pair_count: 1,
      claimed_at_ms: T0,
      pairs: [{ source: "alarms:v1" }],
    })),
    null,
  );
});

Deno.test("translationPolicyPlasmidFields: produces target + body fields", async () => {
  const monitor = new TranslationPolicyMonitor(0xAA, policyRegistry([]));
  const claim = monitor.localClaim(T0);
  const fields = translationPolicyPlasmidFields(0xBB, claim);
  assertEquals(fields.translationPolicyTarget, 0xBB);
  const decoded = decodeTranslationPolicyMeshPayload(
    fields.translationPolicyBody,
  );
  assertEquals(decoded?.peer_id, 0xAA);
});

Deno.test("TranslationPolicyMeshBridge: sends local claim", async () => {
  let captured_target = 0;
  let captured_body = "";
  const monitor = new TranslationPolicyMonitor(
    0xAA,
    policyRegistry([
      ["alarms:v1.0", "alarms:v2.0"],
    ]),
  );
  const bridge = new TranslationPolicyMeshBridge(monitor, (target, body) => {
    captured_target = target;
    captured_body = body;
    return true;
  });
  assert(bridge.broadcastLocalClaim(0xBB, T0));
  assertEquals(bridge.sent_count, 1);
  assertEquals(captured_target, 0xBB);
  assertEquals(
    decodeTranslationPolicyMeshPayload(captured_body)?.peer_id,
    0xAA,
  );
});

Deno.test("TranslationPolicyMeshBridge: emit failure propagates", async () => {
  const bridge = new TranslationPolicyMeshBridge(
    new TranslationPolicyMonitor(0xAA, policyRegistry([])),
    () => false,
  );
  assertEquals(bridge.broadcastLocalClaim(0xBB, T0), false);
  assertEquals(bridge.sent_count, 0);
});

Deno.test("decodeTranslationPolicyCorroborationMeshPayload: parses raise", async () => {
  const local = new TranslationPolicyMonitor(
    0xAA,
    policyRegistry([
      ["alarms:v1.0", "alarms:v2.0"],
    ]),
  );
  const peer = new TranslationPolicyMonitor(0xBB, policyRegistry([]));
  local.observeClaim(peer.localClaim(T0), T0);
  const raise = buildTranslationPolicyCorroborationRaise(
    local.recentAlarms()[0],
    0xCA,
    T0,
  );
  const decoded = decodeTranslationPolicyCorroborationMeshPayload(
    JSON.stringify(raise),
  );
  assertEquals(decoded?.witness_id, 0xCA);
  assertEquals(decoded?.drift_hash, raise.drift_hash);
});

Deno.test("decodeTranslationPolicyCorroborationMeshPayload: rejects malformed", async () => {
  assertEquals(
    decodeTranslationPolicyCorroborationMeshPayload("not json"),
    null,
  );
  assertEquals(
    decodeTranslationPolicyCorroborationMeshPayload(JSON.stringify({
      schema: "OMEGA-1700/v1",
      drift_hash: 1,
    })),
    null,
  );
});

Deno.test("translationPolicyCorroborationPlasmidFields: produces target + body fields", async () => {
  const local = new TranslationPolicyMonitor(
    0xAA,
    policyRegistry([
      ["alarms:v1.0", "alarms:v2.0"],
    ]),
  );
  const peer = new TranslationPolicyMonitor(0xBB, policyRegistry([]));
  local.observeClaim(peer.localClaim(T0), T0);
  const raise = buildTranslationPolicyCorroborationRaise(
    local.recentAlarms()[0],
    0xCA,
    T0,
  );
  const fields = translationPolicyCorroborationPlasmidFields(0xBB, raise);
  assertEquals(fields.translationPolicyCorroborationTarget, 0xBB);
  assertEquals(
    decodeTranslationPolicyCorroborationMeshPayload(
      fields.translationPolicyCorroborationBody,
    )?.witness_id,
    0xCA,
  );
});

Deno.test("TranslationPolicyCorroborationMeshBridge: sends raise", async () => {
  let captured_target = 0;
  let captured_body = "";
  const bridge = new TranslationPolicyCorroborationMeshBridge(
    new TranslationPolicyCorroborationTracker(),
    (target, body) => {
      captured_target = target;
      captured_body = body;
      return true;
    },
  );
  const local = new TranslationPolicyMonitor(
    0xAA,
    policyRegistry([
      ["alarms:v1.0", "alarms:v2.0"],
    ]),
  );
  const peer = new TranslationPolicyMonitor(0xBB, policyRegistry([]));
  local.observeClaim(peer.localClaim(T0), T0);
  const raise = buildTranslationPolicyCorroborationRaise(
    local.recentAlarms()[0],
    0xCA,
    T0,
  );
  assert(bridge.sendRaise(0xBB, raise));
  assertEquals(bridge.sent_count, 1);
  assertEquals(captured_target, 0xBB);
  assertEquals(
    decodeTranslationPolicyCorroborationMeshPayload(captured_body)?.witness_id,
    0xCA,
  );
});

function tpddReplayDigestClaim(
  digest = 0xD1CE,
): TranslationPolicyReplayDigestDigestForensicReplayDigestClaim {
  return {
    schema: "OMEGA-2030/v1",
    digest_schema: "OMEGA-2010/v1",
    peer_id: 0xAA,
    witness_id: 0xCA,
    digest,
    band_timeline_hash: 0x10,
    consensus_interval_hash: 0x20,
    error_window_hash: 0x30,
    classified_events: 2,
    malformed_payloads: 0,
    final_band: "drift",
    final_consensus_digest: 0xBBBB,
    claimed_at_ms: T0,
  };
}

Deno.test("decodeTranslationPolicyReplayDigestDigestForensicReplayDigestMeshPayload: parses Era 2030 claim", async () => {
  const claim = tpddReplayDigestClaim();
  const decoded =
    decodeTranslationPolicyReplayDigestDigestForensicReplayDigestMeshPayload(
      JSON.stringify(claim),
    );
  assertEquals(decoded?.schema, "OMEGA-2030/v1");
  assertEquals(decoded?.digest_schema, "OMEGA-2010/v1");
  assertEquals(decoded?.digest, 0xD1CE);
});

Deno.test("decodeTranslationPolicyReplayDigestDigestForensicReplayDigestMeshPayload: rejects malformed claim", async () => {
  assertEquals(
    decodeTranslationPolicyReplayDigestDigestForensicReplayDigestMeshPayload(
      "not json",
    ),
    null,
  );
  assertEquals(
    decodeTranslationPolicyReplayDigestDigestForensicReplayDigestMeshPayload(
      JSON.stringify({ ...tpddReplayDigestClaim(), schema: "OMEGA-2040/v1" }),
    ),
    null,
  );
  assertEquals(
    decodeTranslationPolicyReplayDigestDigestForensicReplayDigestMeshPayload(
      JSON.stringify({
        ...tpddReplayDigestClaim(),
        digest_schema: "OMEGA-1940/v1",
      }),
    ),
    null,
  );
});

Deno.test("translationPolicyReplayDigestDigestForensicReplayDigestPlasmidFields: produces target + body fields", async () => {
  const claim = tpddReplayDigestClaim();
  const fields =
    translationPolicyReplayDigestDigestForensicReplayDigestPlasmidFields(
      0xBB,
      claim,
    );
  assertEquals(
    fields.translationPolicyReplayDigestDigestForensicReplayDigestTarget,
    0xBB,
  );
  assertEquals(
    decodeTranslationPolicyReplayDigestDigestForensicReplayDigestMeshPayload(
      fields.translationPolicyReplayDigestDigestForensicReplayDigestBody,
    )?.digest,
    0xD1CE,
  );
});

Deno.test("TranslationPolicyReplayDigestDigestForensicReplayDigestMeshBridge: sends claim", async () => {
  let captured_target = 0;
  let captured_body = "";
  const bridge =
    new TranslationPolicyReplayDigestDigestForensicReplayDigestMeshBridge(
      (target, body) => {
        captured_target = target;
        captured_body = body;
        return true;
      },
    );
  assert(bridge.sendClaim(0xBB, tpddReplayDigestClaim()));
  assertEquals(bridge.sent_count, 1);
  assertEquals(captured_target, 0xBB);
  assertEquals(
    decodeTranslationPolicyReplayDigestDigestForensicReplayDigestMeshPayload(
      captured_body,
    )?.witness_id,
    0xCA,
  );
});

Deno.test("end-to-end: corroboration raise bridge feeds remote tracker", async () => {
  let bridgeB: TranslationPolicyCorroborationMeshBridge;
  const trackerA = new TranslationPolicyCorroborationTracker();
  const trackerB = new TranslationPolicyCorroborationTracker();
  const local = new TranslationPolicyMonitor(
    0xAA,
    policyRegistry([
      ["alarms:v1.0", "alarms:v2.0"],
    ]),
  );
  const peer = new TranslationPolicyMonitor(0xBB, policyRegistry([]));
  local.observeClaim(peer.localClaim(T0), T0);
  const raise = buildTranslationPolicyCorroborationRaise(
    local.recentAlarms()[0],
    0xCA,
    T0,
  );
  const bridgeA = new TranslationPolicyCorroborationMeshBridge(
    trackerA,
    (target, body) => {
      if (target !== 0xBB) return false;
      bridgeB.handleIncoming(body, T0 + 1);
      return true;
    },
  );
  bridgeB = new TranslationPolicyCorroborationMeshBridge(trackerB, () => false);
  assert(bridgeA.sendRaise(0xBB, raise));
  assertEquals(trackerB.size(), 1);
  assertEquals(trackerB.list()[0].witnessed_by, [0xCA]);
});

Deno.test("end-to-end: policy claim bridge feeds remote monitor", async () => {
  let bridgeB: TranslationPolicyMeshBridge;
  const monitorA = new TranslationPolicyMonitor(
    0xAA,
    policyRegistry([
      ["alarms:v1.0", "alarms:v2.0"],
    ]),
  );
  const monitorB = new TranslationPolicyMonitor(0xBB, policyRegistry([]));
  const bridgeA = new TranslationPolicyMeshBridge(monitorA, (target, body) => {
    if (target !== 0xBB) return false;
    bridgeB.handleIncoming(body, T0);
    return true;
  });
  bridgeB = new TranslationPolicyMeshBridge(monitorB, () => false);
  assert(bridgeA.broadcastLocalClaim(0xBB, T0));
  assertEquals(monitorB.driftPeers(T0), [0xAA]);
  assertEquals(monitorB.recentAlarms().length, 1);
});

Deno.test("end-to-end: two bridges connected by MeshBridgeTransport", async () => {
  // Simulate the mesh: emit on A's transport calls B's
  // bridge.handleIncoming, and vice versa.
  let bridgeB: WebRTCEventBridge;
  const sinkA = new ForensicEventSink();
  const sinkB = new ForensicEventSink();
  const txA = new MeshBridgeTransport((target, body) => {
    if (target !== 0xBB) return false;
    const msg = decodeMeshPayload(body);
    if (msg) bridgeB.handleIncoming(msg, T0);
    return true;
  });
  const bridgeA = new WebRTCEventBridge(0xAA, sinkA, txA);
  const txB = new MeshBridgeTransport((target, body) => {
    if (target !== 0xAA) return false;
    const msg = decodeMeshPayload(body);
    if (msg) bridgeA.handleIncoming(msg, T0);
    return true;
  });
  bridgeB = new WebRTCEventBridge(0xBB, sinkB, txB);

  bridgeA.helloPeer(0xBB);
  bridgeB.helloPeer(0xAA);
  sinkA.append("alrm", 0x10, null, T0);
  sinkA.append("alrm", 0x20, null, T0);
  sinkB.append("alrm", 0x30, null, T0);

  // B announces its hash list → A automatically ships {10, 20}.
  bridgeB.broadcastHashList(0xAA, T0);
  assertEquals(sinkB.size(), 3);

  // Symmetric: A announces → B ships {30}.
  bridgeA.broadcastHashList(0xBB, T0 + 100);
  assertEquals(sinkA.size(), 3);
  assertEquals(bridgeA.anchor(), bridgeB.anchor());
});

Deno.test("schema constant", async () => {
  assertEquals(MESH_BRIDGE_SCHEMA, "OMEGA-1510/v1");
});
