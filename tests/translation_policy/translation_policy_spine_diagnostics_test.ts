// Era 2060: Translation policy spine diagnostics tests.
import { assert, assertEquals } from "jsr:@std/assert";
import {
  formatTranslationPolicySpineCapList,
  formatTranslationPolicySpineDiagnostics,
  TRANSLATION_POLICY_SPINE_DIAGNOSTICS_SCHEMA,
  translationPolicySpineDiagnosticBand,
  translationPolicySpineDiagnosticFields,
  translationPolicySpineDiagnosticGlyph,
} from "../../src/network/translation_policy/translation_policy_spine_diagnostics.ts";
import {
  TranslationPolicySpineCompression,
  translationPolicySpineCompression,
} from "../../src/network/translation_policy/translation_policy_protocol_registry.ts";

Deno.test("spine diagnostics: formats current compression as capped", async () => {
  const snap = formatTranslationPolicySpineDiagnostics();
  assertEquals(snap.schema, TRANSLATION_POLICY_SPINE_DIAGNOSTICS_SCHEMA);
  assertEquals(snap.compression_schema, "OMEGA-2050/v1");
  assertEquals(snap.band, "capped");
  assertEquals(snap.glyph, "CAP");
  assertEquals(snap.capped_range, "2040");
  assert(snap.summary.includes("CAP CAPPED TPOL-SPINE"));
  assert(snap.summary.includes("recursive1 capped1"));
});

Deno.test("spine diagnostics: fields preserve compact operator order", async () => {
  const fields = translationPolicySpineDiagnosticFields();
  assertEquals(fields.map((field) => field.label), [
    "TPOL SPINE",
    "TPOL LAYERS",
    "TPOL CAPS",
    "TPOL NEXT",
  ]);
  assertEquals(fields[0].value, "CAP CAPPED");
  assertEquals(fields[1].value, "L23 live16 passive2 audit3");
  assertEquals(fields[2].value, "recursive1 capped1 2040");
});

Deno.test("spine diagnostics: cap list includes era ids for agent audit", async () => {
  const list = formatTranslationPolicySpineCapList();
  assert(list.startsWith("2040:policy-layered-observer"));
  assert(list.endsWith("2040:policy-layered-observer"));
  assertEquals(list.split(",").length, 1);
});

Deno.test("spine diagnostics: detects malformed compression schema as blocked", async () => {
  const compression = {
    ...translationPolicySpineCompression(),
    schema: "OMEGA-2049/v1",
  };
  assertEquals(translationPolicySpineDiagnosticBand(compression), "blocked");
  assertEquals(translationPolicySpineDiagnosticGlyph("blocked"), "BLK");
});

Deno.test("spine diagnostics: detects uncapped recursion as blocked", async () => {
  const compression = {
    ...translationPolicySpineCompression(),
    capped_layers: 1,
    capped_eras: [1910],
  };
  assertEquals(translationPolicySpineDiagnosticBand(compression), "capped");
});

Deno.test("spine diagnostics: review band for passive transport without recursion", async () => {
  const compression: TranslationPolicySpineCompression = {
    schema: "OMEGA-2050/v1",
    total_layers: 2,
    live_operational_layers: 1,
    passive_transport_layers: 1,
    forensic_source_layers: 0,
    offline_audit_layers: 0,
    recursive_derived_layers: 0,
    capped_layers: 0,
    capped_eras: [],
    next_allowed_steps: [],
    entries: [],
  };
  const snap = formatTranslationPolicySpineDiagnostics(compression);
  assertEquals(snap.band, "review");
  assertEquals(snap.capped_range, "none");
});

Deno.test("spine diagnostics: truncates summary deterministically", async () => {
  const snap = formatTranslationPolicySpineDiagnostics(
    translationPolicySpineCompression(),
    {
      max_summary_len: 32,
      next_recommended_step: "diagnostics without live state",
    },
  );
  assertEquals(snap.summary.length, 32);
  assert(snap.summary.endsWith("…"));
});
