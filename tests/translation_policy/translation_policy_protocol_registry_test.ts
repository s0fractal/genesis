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
} from "../../src/network/translation_policy/translation_policy_protocol_registry.ts";

Deno.test("protocol registry: exposes stable schema and sorted era spine", async () => {
  const layers = translationPolicyProtocolLayers();
  assertEquals(TRANSLATION_POLICY_PROTOCOL_REGISTRY_SCHEMA, "OMEGA-2035/v1");
  assertEquals(layers[0].era, 1650);
  assertEquals(layers.at(-1)?.era, 2040);
  for (let i = 1; i < layers.length; i++) {
    assert(layers[i - 1].era < layers[i].era);
  }
});

Deno.test("protocol registry: records live mesh dispatch surfaces", async () => {
  const policy = translationPolicyProtocolLayerByEra(1660);
  const corroboration = translationPolicyProtocolLayerByEra(1700);
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
});

Deno.test("protocol registry: surfaces Era 2040 as offline", async () => {
  const layer = translationPolicyProtocolLayerByEra(2040);
  assertEquals(layer?.status, "offline");
  assert(layer?.capabilities.includes("digest"));
  assert(layer?.capabilities.includes("hud"));
  assert(layer?.capabilities.includes("forensic-event"));
});

Deno.test("protocol registry: audit gap closes after Era 2040 mesh dispatch", async () => {
  const gaps = translationPolicyProtocolGaps();
  assertEquals(gaps, []);
});

Deno.test("protocol registry: audit summarizes status counts and namespaces", async () => {
  const audit = translationPolicyProtocolAudit();
  assertEquals(audit.schema, TRANSLATION_POLICY_PROTOCOL_REGISTRY_SCHEMA);
  assertEquals(audit.total_layers, 23);
  assertEquals(audit.live_wired_layers, 8);
  assertEquals(audit.passive_dispatch_layers, 2);
  assertEquals(audit.offline_layers, 4);
  assertEquals(audit.by_status["claimable-offline"], 0);
  assertEquals(audit.forensic_kinds, ["tpol"]);
  assertEquals(audit.semantic_types, [
    "TRANSLATION_POLICY",
    "TRANSLATION_POLICY_CORROBORATION",
  ]);
  assert(audit.event_names.includes("translationPolicyTelemetry"));
});

Deno.test("protocol registry: status lookup returns defensive copies", async () => {
  const live = translationPolicyProtocolLayersByStatus("live-wired");
  const original = translationPolicyProtocolLayerByEra(live[0].era);
  live[0].capabilities = ["claim"];
  live[0].depends_on = [9999];
  const fresh = translationPolicyProtocolLayerByEra(live[0].era);

  assertNotEquals(fresh?.capabilities, live[0].capabilities);
  assertNotEquals(fresh?.depends_on, live[0].depends_on);
  assertEquals(fresh, original);
});

Deno.test("protocol registry: summary is compact and gap-oriented", async () => {
  assertEquals(
    translationPolicyProtocolSummary(),
    "schema=OMEGA-2035/v1; layers=23; live=8; passive=2; offline=4; gaps=0",
  );
});

Deno.test("spine compression: classifies operational, audit, and recursive surfaces", async () => {
  const compression = translationPolicySpineCompression();
  assertEquals(compression.schema, TRANSLATION_POLICY_SPINE_COMPRESSION_SCHEMA);
  assertEquals(compression.total_layers, 23);
  assertEquals(compression.live_operational_layers, 16);
  assertEquals(compression.passive_transport_layers, 2);
  assertEquals(compression.forensic_source_layers, 1);
  assertEquals(compression.offline_audit_layers, 3);
  assertEquals(compression.recursive_derived_layers, 1);
  assertEquals(compression.capped_layers, 1);
});

Deno.test("spine compression: caps recursive replay-derived ladder at Era 2040+", async () => {
  const capped = translationPolicyCappedRecursiveLayers();
  assertEquals(capped.map((entry) => entry.era), [
    2040,
  ]);
  assertEquals(
    capped.every((entry) => entry.extension_policy === "cap-recursion"),
    true,
  );
});

Deno.test("spine compression: keeps base policy runtime live-operational", async () => {
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
    translationPolicySpinePolicyForEra(2040)?.extension_policy,
    "cap-recursion",
  );
});

Deno.test("spine compression: returns defensive policy entries", async () => {
  const compression = translationPolicySpineCompression();
  const entry = compression.entries[0];
  entry.role = "recursive-derived";
  assertEquals(
    translationPolicySpinePolicyForEra(1650)?.role,
    "live-operational",
  );
});

Deno.test("spine compression: summary is compact and cap-oriented", async () => {
  assertEquals(
    translationPolicySpineCompressionSummary(),
    "schema=OMEGA-2050/v1; layers=23; live=16; passive=2; audit=3; recursive=1; capped=2040",
  );
});
