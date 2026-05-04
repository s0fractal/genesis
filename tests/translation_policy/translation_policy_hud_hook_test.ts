// Era 1760: Translation policy bootstrap HUD hook tests.
import { assertEquals } from "jsr:@std/assert";
import {
    createTranslationPolicyHudHook,
    DEFAULT_TRANSLATION_POLICY_HUD_HOOK_OPTS,
    mergeTranslationPolicyHudHookOptions,
    TRANSLATION_POLICY_HUD_HOOK_SCHEMA,
    TranslationPolicyHudHook,
} from "../../src/bootstrap/translation_policy/translation_policy_hud_hook.ts";
import { TranslationPolicyRuntimeTelemetry } from "../../src/network/translation_policy/translation_policy_runtime.ts";

function telemetry(
    overrides: Partial<TranslationPolicyRuntimeTelemetry> = {},
): TranslationPolicyRuntimeTelemetry {
    const base: TranslationPolicyRuntimeTelemetry = {
        schema: "OMEGA-1740/v1",
        active: true,
        live_active: true,
        directory_active: true,
        peer_count: 2,
        due_peer_count: 1,
        live: {
            claims_received: 2,
            claims_malformed: 0,
            claims_observed: 2,
            corroboration_raises_received: 0,
            corroboration_raises_malformed: 0,
            corroboration_raises_recorded: 0,
            local_raises_built: 0,
            local_raises_emitted: 0,
            local_raises_failed: 0,
            local_raises_skipped: 0,
        },
        directory: {
            joined_received: 2,
            left_received: 0,
            activity_received: 2,
            malformed_events: 0,
            peers_added: 2,
            peers_removed: 0,
            activity_peers_seen: 2,
        },
        loop: {
            claims_observed: 2,
            malformed_claims: 0,
            drift_events_seen: 0,
            proposals_built: 0,
            proposals_emitted: 0,
            proposals_failed: 0,
            proposals_deduped: 0,
            corroboration_blocked: 0,
            observed_peer_count: 2,
            drift_peer_count: 0,
            monitor_alarm_count: 0,
            corroborated_drift_count: 0,
            local_policy_hash: 0xABCD_EF01,
            local_pair_count: 1,
        },
    };
    return {
        ...base,
        ...overrides,
        live: { ...base.live, ...(overrides.live ?? {}) },
        directory: { ...base.directory, ...(overrides.directory ?? {}) },
        loop: { ...base.loop, ...(overrides.loop ?? {}) },
    };
}

Deno.test("hook: disabled by default and does not write HUD", async () => {
    const writes: unknown[] = [];
    const hook = new TranslationPolicyHudHook(
        { telemetry: () => telemetry() },
        (...args) => writes.push(args),
    );
    const result = hook.tick(1000);
    assertEquals(result.schema, TRANSLATION_POLICY_HUD_HOOK_SCHEMA);
    assertEquals(result.updated, false);
    assertEquals(result.reason, "disabled");
    assertEquals(writes.length, 0);
});

Deno.test("hook: enabled writes compact summary to configured slot", async () => {
    const writes: unknown[] = [];
    const hook = new TranslationPolicyHudHook(
        { telemetry: () => telemetry() },
        (...args) => writes.push(args),
        {
            ...DEFAULT_TRANSLATION_POLICY_HUD_HOOK_OPTS,
            enabled: true,
            slot: "e",
            label: "POLICY",
        },
    );
    const result = hook.tick(1000);
    assertEquals(result.updated, true);
    assertEquals(result.reason, "updated");
    assertEquals(writes.length, 1);
    assertEquals(writes[0], ["e", "POLICY", result.summary]);
    assertEquals(String(result.summary).includes("TPOL NOMINAL"), true);
});

Deno.test("hook: interval throttles repeated HUD writes", async () => {
    const writes: unknown[] = [];
    const hook = new TranslationPolicyHudHook(
        { telemetry: () => telemetry() },
        (...args) => writes.push(args),
        {
            ...DEFAULT_TRANSLATION_POLICY_HUD_HOOK_OPTS,
            enabled: true,
            min_interval_ms: 500,
        },
    );
    assertEquals(hook.tick(1000).reason, "updated");
    assertEquals(hook.tick(1200).reason, "cooldown");
    assertEquals(hook.tick(1500).reason, "updated");
    assertEquals(writes.length, 2);
});

Deno.test("hook: runtime exceptions are contained", async () => {
    const writes: unknown[] = [];
    const hook = new TranslationPolicyHudHook(
        { telemetry: () => { throw new Error("boom"); } },
        (...args) => writes.push(args),
        {
            ...DEFAULT_TRANSLATION_POLICY_HUD_HOOK_OPTS,
            enabled: true,
        },
    );
    const result = hook.tick(1000);
    assertEquals(result.updated, false);
    assertEquals(result.reason, "runtime-error");
    assertEquals(writes.length, 0);
});

Deno.test("factory: null source keeps bootstrap inert", async () => {
    const hook = createTranslationPolicyHudHook(null, () => {});
    assertEquals(hook, null);
});

Deno.test("options: partial hook options merge nested HUD options", async () => {
    const opts = mergeTranslationPolicyHudHookOptions({
        enabled: true,
        hud: { max_summary_len: 12 },
    });
    assertEquals(opts.enabled, true);
    assertEquals(opts.slot, "c");
    assertEquals(opts.hud.max_summary_len, 12);
});

Deno.test("schema constant", async () => {
    assertEquals(TRANSLATION_POLICY_HUD_HOOK_SCHEMA, "OMEGA-1760/v1");
});
