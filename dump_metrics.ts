import {
  TRANSLATION_POLICY_PROTOCOL_REGISTRY_SCHEMA,
  TRANSLATION_POLICY_SPINE_COMPRESSION_SCHEMA,
  translationPolicyCappedRecursiveLayers,
  translationPolicyProtocolAudit,
  translationPolicyProtocolLayers,
  translationPolicyProtocolSummary,
  translationPolicySpineCompression,
  translationPolicySpineCompressionSummary,
} from "./src/network/translation_policy/translation_policy_protocol_registry.ts";

console.log("layers.length:", translationPolicyProtocolLayers().length);
console.log("layers.at(-1)?.era:", translationPolicyProtocolLayers().at(-1)?.era);
console.log("audit:", JSON.stringify(translationPolicyProtocolAudit()));
console.log("summary:", translationPolicyProtocolSummary());
console.log("compression.total_layers:", translationPolicySpineCompression().total_layers);
console.log("compression.live_operational_layers:", translationPolicySpineCompression().live_operational_layers);
console.log("compression.passive_transport_layers:", translationPolicySpineCompression().passive_transport_layers);
console.log("compression.forensic_source_layers:", translationPolicySpineCompression().forensic_source_layers);
console.log("compression.offline_audit_layers:", translationPolicySpineCompression().offline_audit_layers);
console.log("compression.recursive_derived_layers:", translationPolicySpineCompression().recursive_derived_layers);
console.log("compression.capped_layers:", translationPolicySpineCompression().capped_layers);
console.log("capped layers:", translationPolicyCappedRecursiveLayers().map(e => e.era));
console.log("eras:", translationPolicyProtocolLayers().map(l => l.era));
console.log("role for 1830:", translationPolicySpineCompression().entries.find(e => e.era === 1830)?.role);
console.log("role for 1860:", translationPolicySpineCompression().entries.find(e => e.era === 1860)?.role);
