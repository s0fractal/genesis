// OMEGA-64: Era 2060 - Translation Policy Compression Diagnostics
//
// Pure formatter over Era 2050 spine compression. It makes registry cap
// policy visible to operators and future agents without adding live state,
// DOM writes, timers, mesh IO, or forensic sink mutation.

import {
  TRANSLATION_POLICY_SPINE_COMPRESSION_SCHEMA,
  TranslationPolicySpineCompression,
  translationPolicySpineCompression,
} from "./translation_policy_protocol_registry.ts";

export const TRANSLATION_POLICY_SPINE_DIAGNOSTICS_SCHEMA = "OMEGA-2060/v1";

export type TranslationPolicySpineDiagnosticBand =
  | "nominal"
  | "review"
  | "capped"
  | "blocked";

export interface TranslationPolicySpineDiagnosticField {
  label: string;
  value: string;
}

export interface TranslationPolicySpineDiagnosticsSnapshot {
  schema: string;
  compression_schema: string;
  band: TranslationPolicySpineDiagnosticBand;
  glyph: string;
  summary: string;
  capped_range: string;
  next_recommended_step: string;
  fields: {
    posture: TranslationPolicySpineDiagnosticField;
    layers: TranslationPolicySpineDiagnosticField;
    caps: TranslationPolicySpineDiagnosticField;
    next: TranslationPolicySpineDiagnosticField;
  };
}

export interface TranslationPolicySpineDiagnosticsOptions {
  max_summary_len: number;
  next_recommended_step: string;
}

export const DEFAULT_TRANSLATION_POLICY_SPINE_DIAGNOSTICS_OPTS:
  TranslationPolicySpineDiagnosticsOptions = {
    max_summary_len: 128,
    next_recommended_step:
      "surface compression diagnostics in existing operator telemetry",
  };

export function translationPolicySpineDiagnosticBand(
  compression: TranslationPolicySpineCompression,
): TranslationPolicySpineDiagnosticBand {
  if (compression.schema !== TRANSLATION_POLICY_SPINE_COMPRESSION_SCHEMA) {
    return "blocked";
  }
  if (
    compression.recursive_derived_layers > 0 &&
    compression.capped_layers < compression.recursive_derived_layers
  ) {
    return "blocked";
  }
  if (compression.capped_layers > 0) return "capped";
  if (compression.passive_transport_layers > 0) return "review";
  return "nominal";
}

export function translationPolicySpineDiagnosticGlyph(
  band: TranslationPolicySpineDiagnosticBand,
): string {
  switch (band) {
    case "nominal":
      return "OK";
    case "review":
      return "RV";
    case "capped":
      return "CAP";
    case "blocked":
      return "BLK";
  }
}

export function formatTranslationPolicySpineDiagnostics(
  compression: TranslationPolicySpineCompression =
    translationPolicySpineCompression(),
  opts: TranslationPolicySpineDiagnosticsOptions =
    DEFAULT_TRANSLATION_POLICY_SPINE_DIAGNOSTICS_OPTS,
): TranslationPolicySpineDiagnosticsSnapshot {
  const band = translationPolicySpineDiagnosticBand(compression);
  const glyph = translationPolicySpineDiagnosticGlyph(band);
  const capped_range = formatEraRange(compression.capped_eras);
  const postureValue = `${glyph} ${band.toUpperCase()}`;
  const layersValue =
    `L${compression.total_layers} live${compression.live_operational_layers} passive${compression.passive_transport_layers} audit${compression.offline_audit_layers}`;
  const capsValue =
    `recursive${compression.recursive_derived_layers} capped${compression.capped_layers} ${capped_range}`;
  const nextValue = opts.next_recommended_step;
  const summary = truncate(
    `${postureValue} TPOL-SPINE | ${layersValue} | ${capsValue} | next ${nextValue}`,
    opts.max_summary_len,
  );
  return {
    schema: TRANSLATION_POLICY_SPINE_DIAGNOSTICS_SCHEMA,
    compression_schema: compression.schema,
    band,
    glyph,
    summary,
    capped_range,
    next_recommended_step: nextValue,
    fields: {
      posture: { label: "TPOL SPINE", value: postureValue },
      layers: { label: "TPOL LAYERS", value: layersValue },
      caps: { label: "TPOL CAPS", value: capsValue },
      next: { label: "TPOL NEXT", value: nextValue },
    },
  };
}

export function translationPolicySpineDiagnosticFields(
  compression: TranslationPolicySpineCompression =
    translationPolicySpineCompression(),
  opts: TranslationPolicySpineDiagnosticsOptions =
    DEFAULT_TRANSLATION_POLICY_SPINE_DIAGNOSTICS_OPTS,
): TranslationPolicySpineDiagnosticField[] {
  const snap = formatTranslationPolicySpineDiagnostics(compression, opts);
  return [
    snap.fields.posture,
    snap.fields.layers,
    snap.fields.caps,
    snap.fields.next,
  ];
}

export function formatTranslationPolicySpineCapList(
  compression: TranslationPolicySpineCompression =
    translationPolicySpineCompression(),
): string {
  return compression.entries
    .filter((entry) => entry.extension_policy === "cap-recursion")
    .map((entry) => `${entry.era}:${entry.id}`)
    .join(",");
}

function formatEraRange(eras: readonly number[]): string {
  if (eras.length === 0) return "none";
  const sorted = [...eras].sort((a, b) => a - b);
  let regularStep = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] !== 10) {
      regularStep = false;
      break;
    }
  }
  if (regularStep && sorted.length > 1) {
    return `${sorted[0]}-${sorted[sorted.length - 1]} (${sorted.length})`;
  }
  return sorted.join(",");
}

function truncate(s: string, max: number): string {
  if (max <= 0) return "";
  if (s.length <= max) return s;
  if (max <= 1) return s.slice(0, max);
  return `${s.slice(0, max - 1)}…`;
}
