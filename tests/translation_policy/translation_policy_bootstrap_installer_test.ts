// Era 1790: Translation policy bootstrap installer tests.
import { assertEquals } from "jsr:@std/assert";
import { LocalEventSource } from "../../src/network/quarantine_lifecycle_bridge.ts";
import { PlasmidPayload } from "../../src/network/libp2p_mesh.ts";
import { SchemaTranslatorRegistry } from "../../src/network/schema_translator.ts";
import {
    installTranslationPolicyBootstrap,
    TRANSLATION_POLICY_BOOTSTRAP_INSTALLER_SCHEMA,
    TranslationPolicyBootstrapGlobalTarget,
} from "../../src/bootstrap/translation_policy/translation_policy_bootstrap_installer.ts";

const T0 = 1_000_000;

class FakeMesh {
    plasmids: PlasmidPayload[] = [];
    fail = false;

    enqueuePlasmid(plasmid: PlasmidPayload): void {
        if (this.fail) throw new Error("enqueue failed");
        this.plasmids.push(plasmid);
    }
}

function registry(): SchemaTranslatorRegistry {
    const r = new SchemaTranslatorRegistry();
    r.register("alarms:v1.0", "alarms:v2.0", (event) => event);
    return r;
}

Deno.test("installer: disabled config is inert", async () => {
    const mesh = new FakeMesh();
    const target: TranslationPolicyBootstrapGlobalTarget = {};
    const result = installTranslationPolicyBootstrap(
        mesh,
        { enabled: false },
        target,
    );
    assertEquals(result.schema, TRANSLATION_POLICY_BOOTSTRAP_INSTALLER_SCHEMA);
    assertEquals(result.installed, false);
    assertEquals(result.reason, "disabled");
    assertEquals(target.__OMEGA_TRANSLATION_POLICY_RUNTIME__, undefined);
});

Deno.test("installer: missing peer ids does not throw or install", async () => {
    const result = installTranslationPolicyBootstrap(
        new FakeMesh(),
        { enabled: true },
        {},
    );
    assertEquals(result.installed, false);
    assertEquals(result.reason, "invalid-peer-id");
});

Deno.test("installer: installs runtime, starts it, and sets HUD global", async () => {
    const mesh = new FakeMesh();
    const source = new LocalEventSource();
    const target: TranslationPolicyBootstrapGlobalTarget = {};
    const result = installTranslationPolicyBootstrap(
        mesh,
        {
            enabled: true,
            local_peer_id: 0xAA,
            witness_id: 0xA1,
            registry: registry(),
            event_source: source,
            now_ms: () => T0,
            hud: { enabled: true, slot: "e" },
        },
        target,
    );
    assertEquals(result.installed, true);
    assertEquals(result.reason, "installed");
    assertEquals(result.factory?.runtime.isActive(), true);
    assertEquals(target.__OMEGA_TRANSLATION_POLICY_RUNTIME__, result.factory?.runtime);
    assertEquals(target.__OMEGA_TRANSLATION_POLICY_HUD__, { enabled: true, slot: "e" });
    assertEquals(target.__OMEGA_TRANSLATION_POLICY_TICK__, true);
});

Deno.test("installer: installed runtime broadcasts through mesh adapter", async () => {
    const mesh = new FakeMesh();
    const source = new LocalEventSource();
    const result = installTranslationPolicyBootstrap(
        mesh,
        {
            enabled: true,
            local_peer_id: 0xAA,
            witness_id: 0xA1,
            event_source: source,
            now_ms: () => T0,
            mesh_emit: { matrix: 0x1234_5678 },
        },
        {},
    );
    source.dispatch("meshPeerJoined", { peer_id: 0xBB }); await new Promise(r => setTimeout(r, 0));
    result.factory?.runtime.tick(T0);
    assertEquals(mesh.plasmids.length, 1);
    assertEquals(mesh.plasmids[0].semanticType, "TRANSLATION_POLICY");
    assertEquals(mesh.plasmids[0].matrix, 0x1234_5678);
    assertEquals(mesh.plasmids[0].inverse, (~0x1234_5678) >>> 0);
});

Deno.test("installer: auto_start can remain disabled", async () => {
    const source = new LocalEventSource();
    const result = installTranslationPolicyBootstrap(
        new FakeMesh(),
        {
            enabled: true,
            local_peer_id: 0xAA,
            witness_id: 0xA1,
            event_source: source,
            auto_start: false,
            now_ms: () => T0,
        },
        {},
    );
    assertEquals(result.installed, true);
    assertEquals(result.factory?.runtime.isActive(), false);
});

Deno.test("installer: tick global can be disabled or configured", async () => {
    const disabledTarget: TranslationPolicyBootstrapGlobalTarget = {};
    installTranslationPolicyBootstrap(
        new FakeMesh(),
        {
            enabled: true,
            local_peer_id: 0xAA,
            witness_id: 0xA1,
            tick: false,
        },
        disabledTarget,
    );
    assertEquals(disabledTarget.__OMEGA_TRANSLATION_POLICY_TICK__, false);

    const configuredTarget: TranslationPolicyBootstrapGlobalTarget = {};
    installTranslationPolicyBootstrap(
        new FakeMesh(),
        {
            enabled: true,
            local_peer_id: 0xAA,
            witness_id: 0xA1,
            tick: { enabled: true, min_interval_ms: 250, max_peers_per_tick: 2 },
        },
        configuredTarget,
    );
    assertEquals(configuredTarget.__OMEGA_TRANSLATION_POLICY_TICK__, {
        enabled: true,
        min_interval_ms: 250,
        max_peers_per_tick: 2,
    });
});

Deno.test("installer: telemetry event global can be disabled or configured", async () => {
    const defaultTarget: TranslationPolicyBootstrapGlobalTarget = {};
    installTranslationPolicyBootstrap(
        new FakeMesh(),
        {
            enabled: true,
            local_peer_id: 0xAA,
            witness_id: 0xA1,
        },
        defaultTarget,
    );
    assertEquals(defaultTarget.__OMEGA_TRANSLATION_POLICY_TELEMETRY_EVENT__, false);

    const configuredTarget: TranslationPolicyBootstrapGlobalTarget = {};
    installTranslationPolicyBootstrap(
        new FakeMesh(),
        {
            enabled: true,
            local_peer_id: 0xAA,
            witness_id: 0xA1,
            telemetry_event: {
                enabled: true,
                min_interval_ms: 250,
                event_name: "omegaTpolTelemetry",
            },
        },
        configuredTarget,
    );
    assertEquals(configuredTarget.__OMEGA_TRANSLATION_POLICY_TELEMETRY_EVENT__, {
        enabled: true,
        min_interval_ms: 250,
        event_name: "omegaTpolTelemetry",
    });
});

Deno.test("installer: adapter construction failure is contained", async () => {
    const result = installTranslationPolicyBootstrap(
        new FakeMesh(),
        {
            enabled: true,
            local_peer_id: 0xAA,
            witness_id: 0xA1,
            mesh_emit: { matrix: 0x1234, inverse: 0 },
        },
        {},
    );
    assertEquals(result.installed, false);
    assertEquals(result.reason, "install-error");
});

Deno.test("schema constant", async () => {
    assertEquals(TRANSLATION_POLICY_BOOTSTRAP_INSTALLER_SCHEMA, "OMEGA-1790/v1");
});
