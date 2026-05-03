// Era 1800: Translation policy runtime tick hook tests.
import { assertEquals } from "jsr:@std/assert";
import {
    createTranslationPolicyRuntimeTickHook,
    DEFAULT_TRANSLATION_POLICY_RUNTIME_TICK_HOOK_OPTS,
    mergeTranslationPolicyRuntimeTickHookOptions,
    TRANSLATION_POLICY_RUNTIME_TICK_HOOK_SCHEMA,
    TranslationPolicyRuntimeTickHook,
} from "../src/bootstrap/translation_policy_runtime_tick_hook.ts";
import { TranslationPolicyRuntimeTickResult } from "../src/network/translation_policy_runtime.ts";

function runtimeResult(now_ms: number): TranslationPolicyRuntimeTickResult {
    return {
        schema: "OMEGA-1740/v1",
        now_ms,
        broadcast: {
            schema: "OMEGA-1720/v1",
            now_ms,
            claim: {
                schema: "OMEGA-1650/v1",
                peer_id: 0xAA,
                policy_hash: 0,
                pair_count: 0,
                pairs: [],
                claimed_at_ms: now_ms,
            },
            decisions: [],
            sent_count: 0,
            failed_count: 0,
            skipped_unchanged_count: 0,
            cold_count: 0,
        },
        telemetry: {
            schema: "OMEGA-1740/v1",
            active: true,
            live_active: true,
            directory_active: true,
            peer_count: 0,
            due_peer_count: 0,
            live: {
                claims_received: 0,
                claims_malformed: 0,
                claims_observed: 0,
                corroboration_raises_received: 0,
                corroboration_raises_malformed: 0,
                corroboration_raises_recorded: 0,
                local_raises_built: 0,
                local_raises_emitted: 0,
                local_raises_failed: 0,
                local_raises_skipped: 0,
            },
            directory: {
                joined_received: 0,
                left_received: 0,
                activity_received: 0,
                malformed_events: 0,
                peers_added: 0,
                peers_removed: 0,
                activity_peers_seen: 0,
            },
            loop: {
                claims_observed: 0,
                malformed_claims: 0,
                drift_events_seen: 0,
                proposals_built: 0,
                proposals_emitted: 0,
                proposals_failed: 0,
                proposals_deduped: 0,
                corroboration_blocked: 0,
                observed_peer_count: 0,
                drift_peer_count: 0,
                monitor_alarm_count: 0,
                corroborated_drift_count: 0,
                local_policy_hash: 0,
                local_pair_count: 0,
            },
        },
    };
}

Deno.test("tick hook: disabled by default", () => {
    let calls = 0;
    const hook = new TranslationPolicyRuntimeTickHook({
        tick: () => {
            calls++;
            return runtimeResult(0);
        },
    });
    const result = hook.tick(1000);
    assertEquals(result.schema, TRANSLATION_POLICY_RUNTIME_TICK_HOOK_SCHEMA);
    assertEquals(result.ticked, false);
    assertEquals(result.reason, "disabled");
    assertEquals(calls, 0);
});

Deno.test("tick hook: enabled invokes runtime with max peers", () => {
    const calls: Array<{ now: number; max?: number }> = [];
    const hook = new TranslationPolicyRuntimeTickHook(
        {
            tick: (now, max) => {
                calls.push({ now, max });
                return runtimeResult(now);
            },
        },
        {
            ...DEFAULT_TRANSLATION_POLICY_RUNTIME_TICK_HOOK_OPTS,
            enabled: true,
            max_peers_per_tick: 2,
        },
    );
    const result = hook.tick(1000);
    assertEquals(result.ticked, true);
    assertEquals(result.reason, "ticked");
    assertEquals(calls, [{ now: 1000, max: 2 }]);
});

Deno.test("tick hook: interval throttles runtime ticks", () => {
    let calls = 0;
    const hook = new TranslationPolicyRuntimeTickHook(
        {
            tick: (now) => {
                calls++;
                return runtimeResult(now);
            },
        },
        {
            ...DEFAULT_TRANSLATION_POLICY_RUNTIME_TICK_HOOK_OPTS,
            enabled: true,
            min_interval_ms: 500,
        },
    );
    assertEquals(hook.tick(1000).reason, "ticked");
    assertEquals(hook.tick(1200).reason, "cooldown");
    assertEquals(hook.tick(1500).reason, "ticked");
    assertEquals(calls, 2);
});

Deno.test("tick hook: runtime errors are contained", () => {
    const hook = new TranslationPolicyRuntimeTickHook(
        { tick: () => { throw new Error("boom"); } },
        { ...DEFAULT_TRANSLATION_POLICY_RUNTIME_TICK_HOOK_OPTS, enabled: true },
    );
    const result = hook.tick(1000);
    assertEquals(result.ticked, false);
    assertEquals(result.reason, "runtime-error");
    assertEquals(result.error, "boom");
});

Deno.test("factory: null source remains inert", () => {
    assertEquals(createTranslationPolicyRuntimeTickHook(null), null);
});

Deno.test("options: partial merge preserves defaults", () => {
    const opts = mergeTranslationPolicyRuntimeTickHookOptions({
        enabled: true,
        max_peers_per_tick: 1,
    });
    assertEquals(opts.enabled, true);
    assertEquals(opts.min_interval_ms, 1_000);
    assertEquals(opts.max_peers_per_tick, 1);
});

Deno.test("schema constant", () => {
    assertEquals(TRANSLATION_POLICY_RUNTIME_TICK_HOOK_SCHEMA, "OMEGA-1800/v1");
});
