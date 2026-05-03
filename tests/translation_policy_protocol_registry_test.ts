// Era 2035: Translation policy protocol registry tests.
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert";
import {
  TRANSLATION_POLICY_PROTOCOL_REGISTRY_SCHEMA,
  TRANSLATION_POLICY_SPINE_COMPRESSION_SCHEMA,
  translationPolicyCappedRecursiveLayers,
  translationPolicyProtocolAudit,
  translationPolicyProtocolGaps,
  translationPolicyProtocolLayerByEra,
  translationPolicyProtocolLayers,
  translationPolicyProtocolLayersByStatus,
  translationPolicyProtocolSummary,
  translationPolicySpineCompression,
  translationPolicySpineCompressionSummary,
  translationPolicySpinePolicyForEra,
} from "../src/network/translation_policy_protocol_registry.ts";

Deno.test("protocol registry: exposes stable schema and sorted era spine", () => {
  const layers = translationPolicyProtocolLayers();
  assertEquals(TRANSLATION_POLICY_PROTOCOL_REGISTRY_SCHEMA, "OMEGA-2035/v1");
  assertEquals(layers[0].era, 1650);
  assertEquals(layers.at(-1)?.era, 2030);
  for (let i = 1; i < layers.length; i++) {
    assert(layers[i - 1].era < layers[i].era);
  }
});

Deno.test("protocol registry: records live mesh dispatch surfaces", () => {
  const policy = translationPolicyProtocolLayerByEra(1660);
  const corroboration = translationPolicyProtocolLayerByEra(1700);
  const replay_digest = translationPolicyProtocolLayerByEra(1870);
  const replay_digest_digest = translationPolicyProtocolLayerByEra(1950);

  assertEquals(policy?.semantic_type, "TRANSLATION_POLICY");
  assertEquals(policy?.event_name, "translationPolicyClaim");
  assertEquals(
    corroboration?.semantic_type,
    "TRANSLATION_POLICY_CORROBORATION",
  );
  assertEquals(
    corroboration?.event_name,
    "translationPolicyCorroborationRaise",
  );
  assertEquals(
    replay_digest?.semantic_type,
    "TRANSLATION_POLICY_REPLAY_DIGEST",
  );
  assertEquals(replay_digest?.event_name, "translationPolicyReplayDigestClaim");
  assertEquals(
    replay_digest_digest?.semantic_type,
    "TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST",
  );
  assertEquals(
    replay_digest_digest?.event_name,
    "translationPolicyReplayDigestDigestClaim",
  );
});

Deno.test("protocol registry: surfaces Era 2030 as passively dispatched", () => {
  const layer = translationPolicyProtocolLayerByEra(2030);
  assertEquals(layer?.status, "passive-dispatch");
  assertEquals(layer?.schema, "OMEGA-2030/v1");
  assert(layer?.capabilities.includes("claim"));
  assert(layer?.capabilities.includes("mesh-claim"));
  assertEquals(
    layer?.semantic_type,
    "TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_DIGEST",
  );
  assertEquals(
    layer?.event_name,
    "translationPolicyReplayDigestDigestForensicReplayDigestClaim",
  );
});

Deno.test("protocol registry: audit gap closes after Era 2040 mesh dispatch", () => {
  const gaps = translationPolicyProtocolGaps();
  assertEquals(gaps, []);
});

Deno.test("protocol registry: audit summarizes status counts and namespaces", () => {
  const audit = translationPolicyProtocolAudit();
  assertEquals(audit.schema, TRANSLATION_POLICY_PROTOCOL_REGISTRY_SCHEMA);
  assertEquals(audit.total_layers, 39);
  assertEquals(audit.live_wired_layers, 10);
  assertEquals(audit.passive_dispatch_layers, 5);
  assertEquals(audit.offline_layers, 9);
  assertEquals(audit.by_status["claimable-offline"], 0);
  assertEquals(audit.forensic_kinds, ["tpdd", "tpdq", "tpol"]);
  assertEquals(audit.semantic_types, [
    "TRANSLATION_POLICY",
    "TRANSLATION_POLICY_CORROBORATION",
    "TRANSLATION_POLICY_REPLAY_DIGEST",
    "TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST",
    "TRANSLATION_POLICY_REPLAY_DIGEST_DIGEST_FORENSIC_REPLAY_DIGEST",
  ]);
  assert(audit.event_names.includes("translationPolicyTelemetry"));
});

Deno.test("protocol registry: status lookup returns defensive copies", () => {
  const live = translationPolicyProtocolLayersByStatus("live-wired");
  const original = translationPolicyProtocolLayerByEra(live[0].era);
  live[0].capabilities = ["claim"];
  live[0].depends_on = [9999];
  const fresh = translationPolicyProtocolLayerByEra(live[0].era);

  assertNotEquals(fresh?.capabilities, live[0].capabilities);
  assertNotEquals(fresh?.depends_on, live[0].depends_on);
  assertEquals(fresh, original);
});

Deno.test("protocol registry: summary is compact and gap-oriented", () => {
  assertEquals(
    translationPolicyProtocolSummary(),
    "schema=OMEGA-2035/v1; layers=39; live=10; passive=5; offline=9; gaps=0",
  );
});

Deno.test("spine compression: classifies operational, audit, and recursive surfaces", () => {
  const compression = translationPolicySpineCompression();
  assertEquals(compression.schema, TRANSLATION_POLICY_SPINE_COMPRESSION_SCHEMA);
  assertEquals(compression.total_layers, 39);
  assertEquals(compression.live_operational_layers, 19);
  assertEquals(compression.passive_transport_layers, 3);
  assertEquals(compression.forensic_source_layers, 1);
  assertEquals(compression.offline_audit_layers, 3);
  assertEquals(compression.recursive_derived_layers, 13);
  assertEquals(compression.capped_layers, 13);
});

Deno.test("spine compression: caps recursive replay-derived ladder at Era 1910+", () => {
  const capped = translationPolicyCappedRecursiveLayers();
  assertEquals(capped.map((entry) => entry.era), [
    1910,
    1920,
    1930,
    1940,
    1950,
    1960,
    1970,
    1980,
    1990,
    2000,
    2010,
    2020,
    2030,
  ]);
  assertEquals(
    capped.every((entry) => entry.extension_policy === "cap-recursion"),
    true,
  );
});

Deno.test("spine compression: keeps base policy runtime live-operational", () => {
  assertEquals(
    translationPolicySpinePolicyForEra(1740)?.role,
    "live-operational",
  );
  assertEquals(
    translationPolicySpinePolicyForEra(1740)?.extension_policy,
    "allow-live-integration",
  );
  assertEquals(
    translationPolicySpinePolicyForEra(1830)?.role,
    "forensic-source",
  );
  assertEquals(
    translationPolicySpinePolicyForEra(1860)?.role,
    "offline-audit",
  );
  assertEquals(
    translationPolicySpinePolicyForEra(2030)?.extension_policy,
    "cap-recursion",
  );
});

Deno.test("spine compression: returns defensive policy entries", () => {
  const compression = translationPolicySpineCompression();
  const entry = compression.entries[0];
  entry.role = "recursive-derived";
  assertEquals(
    translationPolicySpinePolicyForEra(1650)?.role,
    "live-operational",
  );
});

Deno.test("spine compression: summary is compact and cap-oriented", () => {
  assertEquals(
    translationPolicySpineCompressionSummary(),
    "schema=OMEGA-2050/v1; layers=39; live=19; passive=3; audit=3; recursive=13; capped=1910,1920,1930,1940,1950,1960,1970,1980,1990,2000,2010,2020,2030",
  );
});
