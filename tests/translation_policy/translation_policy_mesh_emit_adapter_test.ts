// Era 1780: Translation policy mesh emit adapter tests.
import { assertEquals, assertThrows } from "jsr:@std/assert";
import { PlasmidPayload } from "../../src/network/libp2p_mesh.ts";
import {
    WarrantProposalPayload,
    senateHash,
} from "../../src/network/quorum_warrant_bridge.ts";
import { SchemaTranslatorRegistry } from "../../src/network/schema_translator.ts";
import {
    buildTranslationPolicyCorroborationRaise,
} from "../../src/network/translation_policy/translation_policy_corroboration.ts";
import {
    buildTranslationPolicyClaim,
    translationPolicyDriftEvent,
} from "../../src/network/translation_policy/translation_policy_monitor.ts";
import {
    createTranslationPolicyRuntime,
} from "../../src/network/translation_policy/translation_policy_runtime_factory.ts";
import { LocalEventSource } from "../../src/network/quarantine_lifecycle_bridge.ts";
import {
    createTranslationPolicyMeshEmitAdapter,
    DEFAULT_TRANSLATION_POLICY_MESH_EMIT_OPTS,
    TRANSLATION_POLICY_MESH_EMIT_ADAPTER_SCHEMA,
    TranslationPolicyMeshEmitAdapter,
    translationPolicyClaimPlasmid,
    translationPolicyCorroborationPlasmid,
    translationPolicyMeshEmitCallbacks,
    translationPolicyWarrantPlasmid,
} from "../../src/network/translation_policy/translation_policy_mesh_emit_adapter.ts";

const T0 = 1_000_000;

class FakeMesh {
    plasmids: PlasmidPayload[] = [];
    fail = false;

    enqueuePlasmid(plasmid: PlasmidPayload): void {
        if (this.fail) throw new Error("enqueue failed");
        this.plasmids.push(plasmid);
    }
}

function registry(pairs: Array<[string, string]> = []): SchemaTranslatorRegistry {
    const r = new SchemaTranslatorRegistry();
    for (const [source, target] of pairs) r.register(source, target, (event) => event);
    return r;
}

async function warrant(): Promise<WarrantProposalPayload> {
    const proposalDescription = "TPOL peer=0x000000bb local=0x11111111 peerpol=0x22222222";
    return {
        semanticType: "PROPOSAL",
        proposalHash: await senateHash(proposalDescription),
        proposalDescription,
        target_peer_id: 0xBB,
        issued_at_ms: T0,
    };
}

Deno.test("adapter: emits translation policy claim plasmid", async () => {
    const mesh = new FakeMesh();
    const adapter = createTranslationPolicyMeshEmitAdapter(mesh);
    const claim = buildTranslationPolicyClaim(0xAA, registry(), T0);
    assertEquals(adapter.emitClaim(0xBB, JSON.stringify(claim)), true);
    assertEquals(mesh.plasmids.length, 1);
    const p = mesh.plasmids[0];
    assertEquals(p.semanticType, "TRANSLATION_POLICY");
    assertEquals(p.translationPolicyTarget, 0xBB);
    assertEquals(p.translationPolicyBody, JSON.stringify(claim));
    assertEquals((p.matrix ^ p.inverse) >>> 0, 0xFFFF_FFFF);
});

Deno.test("adapter: emits corroboration raise plasmid", async () => {
    const mesh = new FakeMesh();
    const adapter = createTranslationPolicyMeshEmitAdapter(mesh);
    const local = buildTranslationPolicyClaim(0xAA, registry([
        ["alarms:v1.0", "alarms:v2.0"],
    ]), T0);
    const peer = buildTranslationPolicyClaim(0xBB, registry(), T0);
    const event = translationPolicyDriftEvent(local, peer, T0 + 1);
    const raise = buildTranslationPolicyCorroborationRaise(event, 0xCA, T0 + 2);
    assertEquals(adapter.emitCorroborationRaise(0xBB, JSON.stringify(raise)), true);
    const p = mesh.plasmids[0];
    assertEquals(p.semanticType, "TRANSLATION_POLICY_CORROBORATION");
    assertEquals(p.translationPolicyCorroborationTarget, 0xBB);
    assertEquals(p.translationPolicyCorroborationBody, JSON.stringify(raise));
});

Deno.test("adapter: emits Senate-compatible policy warrant proposal plasmid", async () => {
    const mesh = new FakeMesh();
    const adapter = createTranslationPolicyMeshEmitAdapter(mesh);
    const proposal = await warrant();
    assertEquals(adapter.emitWarrantProposal(proposal), true);
    const p = mesh.plasmids[0];
    assertEquals(p.semanticType, "PROPOSAL");
    assertEquals(p.proposalHash, proposal.proposalHash);
    assertEquals(p.proposalDescription, proposal.proposalDescription.slice(0, 64));
    assertEquals(p.parentHash, 0xBB);
    assertEquals(await senateHash(p.proposalDescription!), p.proposalHash);
});

Deno.test("adapter: callbacks match Era 1770 factory contract", async () => {
    const mesh = new FakeMesh();
    const callbacks = translationPolicyMeshEmitCallbacks(mesh);
    const source = new LocalEventSource();
    const runtime = createTranslationPolicyRuntime({
        local_peer_id: 0xAA,
        witness_id: 0xA1,
        registry: registry([["alarms:v1.0", "alarms:v2.0"]]),
        event_source: source,
        claim_emit: callbacks.claim_emit,
        raise_emit: callbacks.raise_emit,
        warrant_emit: callbacks.warrant_emit,
        now_ms: () => T0,
        auto_start: true,
    }).runtime;
    source.dispatch("meshPeerJoined", { peer_id: 0xBB }); await new Promise(r => setTimeout(r, 0));
    runtime.tick(T0);
    assertEquals(mesh.plasmids.map((p) => p.semanticType), ["TRANSLATION_POLICY"]);
});

Deno.test("adapter: telemetry records success and enqueue failures", async () => {
    const mesh = new FakeMesh();
    const adapter = new TranslationPolicyMeshEmitAdapter(mesh);
    assertEquals(adapter.emitClaim(0xBB, "{}"), true);
    mesh.fail = true;
    assertEquals(adapter.emitClaim(0xCC, "{}"), false);
    assertEquals(adapter.telemetry(), {
        claims_sent: 1,
        claims_failed: 1,
        raises_sent: 0,
        raises_failed: 0,
        warrants_sent: 0,
        warrants_failed: 0,
    });
});

Deno.test("builder: custom matrix derives complement inverse by default", async () => {
    const p = translationPolicyClaimPlasmid(0xBB, "{}", { matrix: 0x1234_5678 });
    assertEquals(p.matrix, 0x1234_5678);
    assertEquals(p.inverse, (~0x1234_5678) >>> 0);
});

Deno.test("builder: direct plasmid helpers preserve body fields", async () => {
    const claim = translationPolicyClaimPlasmid(0xBB, "claim-body");
    const raise = translationPolicyCorroborationPlasmid(0xCC, "raise-body");
    const proposal = translationPolicyWarrantPlasmid(await warrant());
    assertEquals(claim.translationPolicyBody, "claim-body");
    assertEquals(raise.translationPolicyCorroborationBody, "raise-body");
    assertEquals(proposal.semanticType, "PROPOSAL");
});

Deno.test("adapter: invalid dipole and recursion are rejected", async () => {
    const mesh = new FakeMesh();
    assertThrows(() => new TranslationPolicyMeshEmitAdapter(mesh, {
        ...DEFAULT_TRANSLATION_POLICY_MESH_EMIT_OPTS,
        inverse: 0,
    }));
    assertThrows(() => new TranslationPolicyMeshEmitAdapter(mesh, {
        ...DEFAULT_TRANSLATION_POLICY_MESH_EMIT_OPTS,
        max_recursion: 0,
    }));
});

Deno.test("schema constant", async () => {
    assertEquals(TRANSLATION_POLICY_MESH_EMIT_ADAPTER_SCHEMA, "OMEGA-1780/v1");
});
