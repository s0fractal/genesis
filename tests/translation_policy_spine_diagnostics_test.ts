// Era 2060: Translation policy spine diagnostics tests.
import { assert, assertEquals } from "jsr:@std/assert";
import {
  formatTranslationPolicySpineCapList,
  formatTranslationPolicySpineDiagnostics,
  TRANSLATION_POLICY_SPINE_DIAGNOSTICS_SCHEMA,
  translationPolicySpineDiagnosticBand,
  translationPolicySpineDiagnosticFields,
  translationPolicySpineDiagnosticGlyph,
} from "../src/network/translation_policy_spine_diagnostics.ts";
import {
  TranslationPolicySpineCompression,
  translationPolicySpineCompression,
} from "../src/network/translation_policy_protocol_registry.ts";

Deno.test("spine diagnostics: formats current compression as capped", () => {
  const snap = formatTranslationPolicySpineDiagnostics();
  assertEquals(snap.schema, TRANSLATION_POLICY_SPINE_DIAGNOSTICS_SCHEMA);
  assertEquals(snap.compression_schema, "OMEGA-2050/v1");
  assertEquals(snap.band, "capped");
  assertEquals(snap.glyph, "CAP");
  assertEquals(snap.capped_range, "1910-2030 (13)");
  assert(snap.summary.includes("CAP CAPPED TPOL-SPINE"));
  assert(snap.summary.includes("recursive13 capped13"));
});

Deno.test("spine diagnostics: fields preserve compact operator order", () => {
  const fields = translationPolicySpineDiagnosticFields();
  assertEquals(fields.map((field) => field.label), [
    "TPOL SPINE",
    "TPOL LAYERS",
    "TPOL CAPS",
    "TPOL NEXT",
  ]);
  assertEquals(fields[0].value, "CAP CAPPED");
  assertEquals(fields[1].value, "L39 live19 passive3 audit3");
  assertEquals(fields[2].value, "recursive13 capped13 1910-2030 (13)");
});

Deno.test("spine diagnostics: cap list includes era ids for agent audit", () => {
  const list = formatTranslationPolicySpineCapList();
  assert(list.startsWith("1910:policy-replay-digest-forensic-event"));
  assert(list.endsWith(
    "2030:policy-replay-digest-digest-forensic-replay-digest-claim",
  ));
  assertEquals(list.split(",").length, 13);
});

Deno.test("spine diagnostics: detects malformed compression schema as blocked", () => {
  const compression = {
    ...translationPolicySpineCompression(),
    schema: "OMEGA-2049/v1",
  };
  assertEquals(translationPolicySpineDiagnosticBand(compression), "blocked");
  assertEquals(translationPolicySpineDiagnosticGlyph("blocked"), "BLK");
});

Deno.test("spine diagnostics: detects uncapped recursion as blocked", () => {
  const compression = {
    ...translationPolicySpineCompression(),
    capped_layers: 1,
    capped_eras: [1910],
  };
  assertEquals(translationPolicySpineDiagnosticBand(compression), "blocked");
});

Deno.test("spine diagnostics: review band for passive transport without recursion", () => {
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

Deno.test("spine diagnostics: truncates summary deterministically", () => {
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
