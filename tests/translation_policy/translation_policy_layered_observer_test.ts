import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert";
import {
  formatLayeredDigestHud,
  TRANSLATION_POLICY_LAYERED_OBSERVER_SCHEMA,
  translationPolicyLayeredDigest,
} from "../../src/network/translation_policy/translation_policy_layered_observer.ts";
import { TRANSLATION_POLICY_FORENSIC_REPLAY_DIGEST_SCHEMA } from "../../src/network/translation_policy/translation_policy_forensic_replay_digest.ts";

Deno.test("translationPolicyLayeredDigest: calculates depth 0 (base)", async () => {
  const base = {
    schema: TRANSLATION_POLICY_FORENSIC_REPLAY_DIGEST_SCHEMA,
    digest: 0xAAAA_BBBB,
    digest_hex: "0xaaaabbbb",
    band_timeline_hash: 0,
    policy_interval_hash: 0,
    error_window_hash: 0,
    classified_events: 0,
    malformed_payloads: 0,
    final_band: "none",
    final_policy_hash: 0,
  };

  const layered = translationPolicyLayeredDigest(base, 0);
  assertEquals(layered.schema, TRANSLATION_POLICY_LAYERED_OBSERVER_SCHEMA);
  assertEquals(layered.depth, 0);
  assertEquals(layered.base_digest, 0xAAAA_BBBB);
  assertEquals(layered.meta_digest, 0xAAAA_BBBB);
  assertEquals(layered.history.length, 1);
});

Deno.test("translationPolicyLayeredDigest: calculates N-depth recursive digest", async () => {
  const base = {
    schema: TRANSLATION_POLICY_FORENSIC_REPLAY_DIGEST_SCHEMA,
    digest: 0x1234_5678,
    digest_hex: "0x12345678",
    band_timeline_hash: 0,
    policy_interval_hash: 0,
    error_window_hash: 0,
    classified_events: 0,
    malformed_payloads: 0,
    final_band: "none",
    final_policy_hash: 0,
  };

  const l1 = translationPolicyLayeredDigest(base, 1);
  const l30 = translationPolicyLayeredDigest(base, 30);

  assertNotEquals(l1.meta_digest, base.digest);
  assertEquals(l1.history.length, 2);
  assertEquals(l30.history.length, 31);
  assertEquals(l30.history[0], base.digest);
  assertEquals(l30.history[1], l1.meta_digest);
});

Deno.test("formatLayeredDigestHud: formats correctly", async () => {
  const base = {
    schema: TRANSLATION_POLICY_FORENSIC_REPLAY_DIGEST_SCHEMA,
    digest: 0x1234_5678,
    digest_hex: "0x12345678",
    band_timeline_hash: 0,
    policy_interval_hash: 0,
    error_window_hash: 0,
    classified_events: 0,
    malformed_payloads: 0,
    final_band: "none",
    final_policy_hash: 0,
  };

  const l0 = translationPolicyLayeredDigest(base, 0);
  const l5 = translationPolicyLayeredDigest(base, 5);

  assertEquals(formatLayeredDigestHud(l0), "[L0 BASE] 0x12345678");
  assert(formatLayeredDigestHud(l5).includes("[L5 META]"));
  assert(formatLayeredDigestHud(l5).includes("(<- ... <- 0x12345678)"));
});
