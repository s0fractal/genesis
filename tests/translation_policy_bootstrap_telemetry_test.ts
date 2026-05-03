// Era 1810: Translation policy bootstrap telemetry snapshot tests.
import { assertEquals } from "jsr:@std/assert";
import { LocalEventSource } from "../src/network/quarantine_lifecycle_bridge.ts";
import { PlasmidPayload } from "../src/network/webrtc_v2.ts";
import { SchemaTranslatorRegistry } from "../src/network/schema_translator.ts";
import {
    installTranslationPolicyBootstrap,
} from "../src/bootstrap/translation_policy_bootstrap_installer.ts";
import {
    TRANSLATION_POLICY_BOOTSTRAP_TELEMETRY_SCHEMA,
    translationPolicyBootstrapTelemetrySnapshot,
} from "../src/bootstrap/translation_policy_bootstrap_telemetry.ts";

const T0 = 1_000_000;

class FakeMesh {
    plasmids: PlasmidPayload[] = [];
    enqueuePlasmid(plasmid: PlasmidPayload): void {
        this.plasmids.push(plasmid);
    }
}

function registry(): SchemaTranslatorRegistry {
    const r = new SchemaTranslatorRegistry();
    r.register("alarms:v1.0", "alarms:v2.0", (event) => event);
    return r;
}

Deno.test("snapshot: disabled install has stable null telemetry", () => {
    const install = installTranslationPolicyBootstrap(
        new FakeMesh(),
        { enabled: false },
        {},
    );
    const snap = translationPolicyBootstrapTelemetrySnapshot(install, null, T0);
    assertEquals(snap.schema, TRANSLATION_POLICY_BOOTSTRAP_TELEMETRY_SCHEMA);
    assertEquals(snap.installed, false);
    assertEquals(snap.install_reason, "disabled");
    assertEquals(snap.tick.reason, "none");
    assertEquals(snap.runtime, null);
    assertEquals(snap.emit, null);
});

Deno.test("snapshot: installed runtime includes runtime and emit telemetry before tick", () => {
    const source = new LocalEventSource();
    const install = installTranslationPolicyBootstrap(
        new FakeMesh(),
        {
            enabled: true,
            local_peer_id: 0xAA,
            witness_id: 0xA1,
            registry: registry(),
            event_source: source,
            now_ms: () => T0,
        },
        {},
    );
    const snap = translationPolicyBootstrapTelemetrySnapshot(install, null, T0);
    assertEquals(snap.installed, true);
    assertEquals(snap.install_reason, "installed");
    assertEquals(snap.runtime?.peer_count, 0);
    assertEquals(snap.emit, {
        claims_sent: 0,
        claims_failed: 0,
        raises_sent: 0,
        raises_failed: 0,
        warrants_sent: 0,
        warrants_failed: 0,
    });
});

Deno.test("snapshot: tick result contributes broadcast counters", () => {
    const source = new LocalEventSource();
    const mesh = new FakeMesh();
    const install = installTranslationPolicyBootstrap(
        mesh,
        {
            enabled: true,
            local_peer_id: 0xAA,
            witness_id: 0xA1,
            registry: registry(),
            event_source: source,
            now_ms: () => T0,
        },
        {},
    );
    source.dispatch("meshPeerJoined", { peer_id: 0xBB });
    const runtimeResult = install.factory!.runtime.tick(T0, 4);
    const snap = translationPolicyBootstrapTelemetrySnapshot(
        install,
        {
            schema: "OMEGA-1800/v1",
            ticked: true,
            reason: "ticked",
            now_ms: T0,
            runtime_result: runtimeResult,
        },
        T0,
    );
    assertEquals(snap.tick.ticked, true);
    assertEquals(snap.tick.sent_count, 1);
    assertEquals(snap.runtime?.peer_count, 1);
    assertEquals(snap.emit?.claims_sent, 1);
    assertEquals(mesh.plasmids.length, 1);
});

Deno.test("snapshot: tick runtime error is surfaced without runtime result", () => {
    const install = installTranslationPolicyBootstrap(
        new FakeMesh(),
        {
            enabled: true,
            local_peer_id: 0xAA,
            witness_id: 0xA1,
            now_ms: () => T0,
        },
        {},
    );
    const snap = translationPolicyBootstrapTelemetrySnapshot(
        install,
        {
            schema: "OMEGA-1800/v1",
            ticked: false,
            reason: "runtime-error",
            now_ms: T0,
            runtime_result: null,
            error: "boom",
        },
        T0,
    );
    assertEquals(snap.tick.reason, "runtime-error");
    assertEquals(snap.tick.error, "boom");
    assertEquals(snap.tick.sent_count, 0);
    assertEquals(snap.runtime?.active, true);
});

Deno.test("schema constant", () => {
    assertEquals(TRANSLATION_POLICY_BOOTSTRAP_TELEMETRY_SCHEMA, "OMEGA-1810/v1");
});
