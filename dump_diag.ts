import {
  formatTranslationPolicySpineCapList,
  formatTranslationPolicySpineDiagnostics,
  translationPolicySpineDiagnosticFields,
} from "./src/network/translation_policy/translation_policy_spine_diagnostics.ts";

const snap = formatTranslationPolicySpineDiagnostics();
console.log("capped_range:", snap.capped_range);
console.log("summary:", snap.summary);

const fields = translationPolicySpineDiagnosticFields();
for (const f of fields) {
    console.log(f.label, "=>", f.value);
}

const list = formatTranslationPolicySpineCapList();
console.log("list:", list);
