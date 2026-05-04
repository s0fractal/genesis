// OMEGA-64: Era 2035 - Translation Policy Protocol Registry
//
// The translation-policy spine grew through many pure, live, forensic,
// replay, digest, claim, and quorum layers. This registry is the compact
// map used to keep future work pointed at integration gaps instead of
// mechanically extending the recursion.

export const TRANSLATION_POLICY_PROTOCOL_REGISTRY_SCHEMA = "OMEGA-2035/v1";
export const TRANSLATION_POLICY_SPINE_COMPRESSION_SCHEMA = "OMEGA-2050/v1";

export type TranslationPolicyProtocolStatus =
  | "core"
  | "passive-dispatch"
  | "live-wired"
  | "forensic"
  | "offline"
  | "claimable-offline";

export type TranslationPolicyProtocolCapability =
  | "monitor"
  | "mesh-claim"
  | "warrant"
  | "corroboration"
  | "runtime"
  | "hud"
  | "bootstrap"
  | "telemetry"
  | "forensic-event"
  | "replay"
  | "digest"
  | "quorum"
  | "live-wiring"
  | "claim";

export type TranslationPolicySpineRole =
  | "live-operational"
  | "passive-transport"
  | "forensic-source"
  | "offline-audit"
  | "recursive-derived";

export type TranslationPolicyExtensionPolicy =
  | "allow-live-integration"
  | "allow-offline-audit"
  | "registry-review-required"
  | "cap-recursion";

export interface TranslationPolicyProtocolLayer {
  era: number;
  id: string;
  status: TranslationPolicyProtocolStatus;
  schema?: string;
  file: string;
  test_file?: string;
  event_name?: string;
  semantic_type?: string;
  payload_body_field?: string;
  payload_target_field?: string;
  forensic_kind?: string;
  depends_on: readonly number[];
  capabilities: readonly TranslationPolicyProtocolCapability[];
}

export interface TranslationPolicyProtocolGap {
  era: number;
  id: string;
  reason: string;
}

export interface TranslationPolicyProtocolAudit {
  schema: string;
  total_layers: number;
  by_status: Record<TranslationPolicyProtocolStatus, number>;
  live_wired_layers: number;
  passive_dispatch_layers: number;
  offline_layers: number;
  semantic_types: readonly string[];
  event_names: readonly string[];
  forensic_kinds: readonly string[];
  gaps: readonly TranslationPolicyProtocolGap[];
}

export interface TranslationPolicySpinePolicyEntry {
  era: number;
  id: string;
  role: TranslationPolicySpineRole;
  extension_policy: TranslationPolicyExtensionPolicy;
  reason: string;
}

export interface TranslationPolicySpineCompression {
  schema: string;
  total_layers: number;
  live_operational_layers: number;
  passive_transport_layers: number;
  forensic_source_layers: number;
  offline_audit_layers: number;
  recursive_derived_layers: number;
  capped_layers: number;
  capped_eras: readonly number[];
  next_allowed_steps: readonly string[];
  entries: readonly TranslationPolicySpinePolicyEntry[];
}

const EMPTY_STATUS_COUNTS: Record<TranslationPolicyProtocolStatus, number> = {
  "core": 0,
  "passive-dispatch": 0,
  "live-wired": 0,
  "forensic": 0,
  "offline": 0,
  "claimable-offline": 0,
};

const LAYERS: readonly TranslationPolicyProtocolLayer[] = [
  layer(1650, "policy-monitor", "core", "translation_policy_monitor.ts", [], [
    "monitor",
  ]),
  layer(
    1660,
    "policy-claim-mesh-dispatch",
    "passive-dispatch",
    "mesh_event_bridge.ts",
    [1650],
    ["mesh-claim"],
    {
      event_name: "translationPolicyClaim",
      semantic_type: "TRANSLATION_POLICY",
      payload_body_field: "translationPolicyBody",
      payload_target_field: "translationPolicyTarget",
    },
  ),
  layer(
    1670,
    "policy-warrant-bridge",
    "core",
    "translation_policy_warrant_bridge.ts",
    [1650],
    [
      "warrant",
    ],
  ),
  layer(
    1680,
    "policy-investigation-loop",
    "core",
    "translation_policy_investigation_loop.ts",
    [1650, 1670],
    [
      "monitor",
      "warrant",
    ],
  ),
  layer(
    1690,
    "policy-corroboration",
    "core",
    "translation_policy_corroboration.ts",
    [1680],
    [
      "corroboration",
    ],
  ),
  layer(
    1700,
    "policy-corroboration-mesh-dispatch",
    "passive-dispatch",
    "mesh_event_bridge.ts",
    [1690],
    ["corroboration", "mesh-claim"],
    {
      schema: "OMEGA-1700/v1",
      event_name: "translationPolicyCorroborationRaise",
      semantic_type: "TRANSLATION_POLICY_CORROBORATION",
      payload_body_field: "translationPolicyCorroborationBody",
      payload_target_field: "translationPolicyCorroborationTarget",
    },
  ),
  layer(
    1710,
    "policy-live-wiring",
    "live-wired",
    "translation_policy_live_wiring_adapter.ts",
    [1660, 1700],
    [
      "live-wiring",
    ],
  ),
  layer(
    1720,
    "policy-broadcast-scheduler",
    "core",
    "translation_policy_broadcast_scheduler.ts",
    [1660],
    [
      "mesh-claim",
    ],
  ),
  layer(
    1730,
    "policy-peer-directory",
    "live-wired",
    "translation_policy_peer_directory.ts",
    [1720],
    [
      "live-wiring",
    ],
  ),
  layer(1740, "policy-runtime", "live-wired", "translation_policy_runtime.ts", [
    1710,
    1720,
    1730,
  ], [
    "runtime",
  ]),
  layer(1750, "policy-hud", "core", "translation_policy_hud.ts", [1740], [
    "hud",
  ]),
  layer(
    1760,
    "policy-hud-hook",
    "live-wired",
    "translation_policy_hud_hook.ts",
    [1750],
    [
      "hud",
      "bootstrap",
    ],
  ),
  layer(
    1770,
    "policy-runtime-factory",
    "core",
    "translation_policy_runtime_factory.ts",
    [1740],
    [
      "runtime",
    ],
  ),
  layer(
    1780,
    "policy-mesh-emit-adapter",
    "core",
    "translation_policy_mesh_emit_adapter.ts",
    [1660, 1700, 1670],
    [
      "mesh-claim",
      "warrant",
    ],
  ),
  layer(
    1790,
    "policy-bootstrap-installer",
    "live-wired",
    "translation_policy_bootstrap_installer.ts",
    [1760, 1770, 1780],
    [
      "bootstrap",
    ],
  ),
  layer(
    1800,
    "policy-runtime-tick-hook",
    "live-wired",
    "translation_policy_runtime_tick_hook.ts",
    [1740, 1790],
    [
      "runtime",
      "bootstrap",
    ],
  ),
  layer(
    1810,
    "policy-bootstrap-telemetry",
    "live-wired",
    "translation_policy_bootstrap_telemetry.ts",
    [1790, 1800],
    [
      "telemetry",
    ],
  ),
  layer(
    1820,
    "policy-telemetry-event",
    "live-wired",
    "translation_policy_telemetry_event.ts",
    [1810],
    [
      "telemetry",
    ],
    { event_name: "translationPolicyTelemetry" },
  ),
  layer(
    1830,
    "policy-forensic-event-adapter",
    "forensic",
    "translation_policy_forensic_event_adapter.ts",
    [1820],
    [
      "forensic-event",
    ],
    { forensic_kind: "tpol" },
  ),
  layer(
    1840,
    "policy-forensic-replay",
    "offline",
    "translation_policy_forensic_replay.ts",
    [1830],
    [
      "replay",
    ],
  ),
  layer(
    1850,
    "policy-forensic-replay-hud",
    "offline",
    "translation_policy_forensic_replay_hud.ts",
    [1840],
    [
      "hud",
    ],
  ),
  layer(
    1860,
    "policy-forensic-replay-digest",
    "offline",
    "translation_policy_forensic_replay_digest.ts",
    [1840],
    [
      "digest",
    ],
  ),
  layer(
    2040,
    "policy-layered-observer",
    "offline",
    "translation_policy_layered_observer.ts",
    [1860],
    [
      "digest",
      "hud",
      "forensic-event",
    ],
  ),
];

export function translationPolicyProtocolLayers(): TranslationPolicyProtocolLayer[] {
  return LAYERS.map(cloneLayer);
}

export function translationPolicyProtocolLayerByEra(
  era: number,
): TranslationPolicyProtocolLayer | undefined {
  const found = LAYERS.find((layer) => layer.era === era);
  return found ? cloneLayer(found) : undefined;
}

export function translationPolicyProtocolLayersByStatus(
  status: TranslationPolicyProtocolStatus,
): TranslationPolicyProtocolLayer[] {
  return LAYERS.filter((layer) => layer.status === status).map(cloneLayer);
}

export function translationPolicyProtocolGaps(): TranslationPolicyProtocolGap[] {
  const gaps: TranslationPolicyProtocolGap[] = [];
  for (const layer of LAYERS) {
    if (
      layer.capabilities.includes("claim") &&
      layer.status === "claimable-offline" &&
      (!layer.semantic_type || !layer.event_name)
    ) {
      gaps.push({
        era: layer.era,
        id: layer.id,
        reason:
          "claim exists, but no passive mesh dispatch semantic/event is registered",
      });
    }
    if (
      layer.status === "passive-dispatch" &&
      (!layer.semantic_type || !layer.event_name ||
        !layer.payload_body_field || !layer.payload_target_field)
    ) {
      gaps.push({
        era: layer.era,
        id: layer.id,
        reason:
          "passive dispatch layer is missing semantic type, event, or payload fields",
      });
    }
  }
  return gaps;
}

export function translationPolicyProtocolAudit(): TranslationPolicyProtocolAudit {
  const by_status = { ...EMPTY_STATUS_COUNTS };
  const semantic_types = new Set<string>();
  const event_names = new Set<string>();
  const forensic_kinds = new Set<string>();

  for (const layer of LAYERS) {
    by_status[layer.status]++;
    if (layer.semantic_type) semantic_types.add(layer.semantic_type);
    if (layer.event_name) event_names.add(layer.event_name);
    if (layer.forensic_kind) forensic_kinds.add(layer.forensic_kind);
  }

  const offline_layers = by_status["offline"] + by_status["claimable-offline"];
  return {
    schema: TRANSLATION_POLICY_PROTOCOL_REGISTRY_SCHEMA,
    total_layers: LAYERS.length,
    by_status,
    live_wired_layers: by_status["live-wired"],
    passive_dispatch_layers: by_status["passive-dispatch"],
    offline_layers,
    semantic_types: Array.from(semantic_types).sort(),
    event_names: Array.from(event_names).sort(),
    forensic_kinds: Array.from(forensic_kinds).sort(),
    gaps: translationPolicyProtocolGaps(),
  };
}

export function translationPolicyProtocolSummary(): string {
  const audit = translationPolicyProtocolAudit();
  const gap_text = audit.gaps.length === 0
    ? "gaps=0"
    : `gaps=${audit.gaps.map((gap) => `${gap.era}:${gap.id}`).join(",")}`;
  return `schema=${audit.schema}; layers=${audit.total_layers}; live=${audit.live_wired_layers}; passive=${audit.passive_dispatch_layers}; offline=${audit.offline_layers}; ${gap_text}`;
}

export function translationPolicySpineCompression(): TranslationPolicySpineCompression {
  const entries = LAYERS.map(compressionEntry);
  return {
    schema: TRANSLATION_POLICY_SPINE_COMPRESSION_SCHEMA,
    total_layers: entries.length,
    live_operational_layers: countRole(entries, "live-operational"),
    passive_transport_layers: countRole(entries, "passive-transport"),
    forensic_source_layers: countRole(entries, "forensic-source"),
    offline_audit_layers: countRole(entries, "offline-audit"),
    recursive_derived_layers: countRole(entries, "recursive-derived"),
    capped_layers:
      entries.filter((entry) => entry.extension_policy === "cap-recursion")
        .length,
    capped_eras: entries
      .filter((entry) => entry.extension_policy === "cap-recursion")
      .map((entry) => entry.era),
    next_allowed_steps: [
      "wire existing passive transports into application-owned consumers",
      "improve operator diagnostics over existing registry/compression output",
      "add offline audit summaries without new live quorum recursion",
      "promote a capped layer only after explicit registry policy change",
    ],
    entries: entries.map(cloneCompressionEntry),
  };
}

export function translationPolicySpinePolicyForEra(
  era: number,
): TranslationPolicySpinePolicyEntry | undefined {
  const layer = LAYERS.find((layer) => layer.era === era);
  return layer ? cloneCompressionEntry(compressionEntry(layer)) : undefined;
}

export function translationPolicyCappedRecursiveLayers(): TranslationPolicySpinePolicyEntry[] {
  return translationPolicySpineCompression().entries
    .filter((entry) => entry.extension_policy === "cap-recursion")
    .map(cloneCompressionEntry);
}

export function translationPolicySpineCompressionSummary(): string {
  const compression = translationPolicySpineCompression();
  return `schema=${compression.schema}; layers=${compression.total_layers}; live=${compression.live_operational_layers}; passive=${compression.passive_transport_layers}; audit=${compression.offline_audit_layers}; recursive=${compression.recursive_derived_layers}; capped=${
    compression.capped_eras.join(",")
  }`;
}

function compressionEntry(
  layer: TranslationPolicyProtocolLayer,
): TranslationPolicySpinePolicyEntry {
  if (layer.era === 2040) {
    return {
      era: layer.era,
      id: layer.id,
      role: "recursive-derived",
      extension_policy: "cap-recursion",
      reason:
        "unified meta-observer for N-depth recursive digests; do not add hardcoded layers",
    };
  }
  if (layer.status === "passive-dispatch") {
    return {
      era: layer.era,
      id: layer.id,
      role: "passive-transport",
      extension_policy: "registry-review-required",
      reason:
        "mesh surface is passive; application ownership and live consumers must be reviewed before adding stateful behavior",
    };
  }
  if (layer.status === "forensic") {
    return {
      era: layer.era,
      id: layer.id,
      role: "forensic-source",
      extension_policy: "allow-offline-audit",
      reason:
        "forensic event source may feed offline replay/audit, but should not own mesh state",
    };
  }
  if (layer.status === "offline") {
    return {
      era: layer.era,
      id: layer.id,
      role: "offline-audit",
      extension_policy: "allow-offline-audit",
      reason:
        "offline interpretation tool; keep pure and detached from live mesh mutation",
    };
  }
  return {
    era: layer.era,
    id: layer.id,
    role: "live-operational",
    extension_policy: "allow-live-integration",
    reason:
      "within the live translation-policy operational spine before recursive replay-derived layers",
  };
}

function countRole(
  entries: readonly TranslationPolicySpinePolicyEntry[],
  role: TranslationPolicySpineRole,
): number {
  return entries.filter((entry) => entry.role === role).length;
}

function cloneCompressionEntry(
  entry: TranslationPolicySpinePolicyEntry,
): TranslationPolicySpinePolicyEntry {
  return { ...entry };
}

function layer(
  era: number,
  id: string,
  status: TranslationPolicyProtocolStatus,
  file: string,
  depends_on: readonly number[],
  capabilities: readonly TranslationPolicyProtocolCapability[],
  extra: Partial<
    Omit<
      TranslationPolicyProtocolLayer,
      "era" | "id" | "status" | "file" | "depends_on" | "capabilities"
    >
  > = {},
): TranslationPolicyProtocolLayer {
  return {
    era,
    id,
    status,
    file,
    test_file: `tests/${file.replace(".ts", "_test.ts")}`,
    depends_on: [...depends_on],
    capabilities: [...capabilities],
    ...extra,
  };
}

function cloneLayer(
  layer: TranslationPolicyProtocolLayer,
): TranslationPolicyProtocolLayer {
  return {
    ...layer,
    depends_on: [...layer.depends_on],
    capabilities: [...layer.capabilities],
  };
}
