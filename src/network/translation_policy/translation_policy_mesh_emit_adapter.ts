// OMEGA-64: Era 1780 - Translation Policy Mesh Emit Adapter
//
// Era 1770's factory intentionally accepts narrow emit callbacks. This
// adapter turns a live WebRTCV2Mesh-like object into those callbacks
// adapter turns a live Libp2pMesh-like object into those callbacks
// using the existing plasmid envelope fields.

import type {
    TranslationPolicyCorroborationPlasmidEmit,
    TranslationPolicyPlasmidEmit,
} from "../mesh_event_bridge.ts";
import type { WarrantProposalPayload } from "../quorum_warrant_bridge.ts";
import type { Libp2pMesh, PlasmidPayload } from "../libp2p_mesh.ts";

export const TRANSLATION_POLICY_MESH_EMIT_ADAPTER_SCHEMA = "OMEGA-1780/v1";

export interface TranslationPolicyMeshLike {
    enqueuePlasmid(plasmid: PlasmidPayload): void;
}

export interface TranslationPolicyMeshEmitOptions {
    matrix: number;
    inverse: number;
    max_recursion: number;
    pulse_freq: number;
    pulse_amp: number;
}

export interface TranslationPolicyMeshEmitTelemetry {
    claims_sent: number;
    claims_failed: number;
    raises_sent: number;
    raises_failed: number;
    warrants_sent: number;
    warrants_failed: number;
}

export interface TranslationPolicyMeshEmitCallbacks {
    claim_emit: TranslationPolicyPlasmidEmit;
    raise_emit: TranslationPolicyCorroborationPlasmidEmit;
    warrant_emit: (proposal: WarrantProposalPayload) => boolean;
}

export const DEFAULT_TRANSLATION_POLICY_MESH_EMIT_OPTS:
    TranslationPolicyMeshEmitOptions = {
        matrix: 0xA11C_E001,
        inverse: (~0xA11C_E001) >>> 0,
        max_recursion: 4,
        pulse_freq: 0,
        pulse_amp: 0,
    };

export class TranslationPolicyMeshEmitAdapter {
    private stats: TranslationPolicyMeshEmitTelemetry = {
        claims_sent: 0,
        claims_failed: 0,
        raises_sent: 0,
        raises_failed: 0,
        warrants_sent: 0,
        warrants_failed: 0,
    };

    constructor(
        public readonly mesh: TranslationPolicyMeshLike,
        public readonly opts: TranslationPolicyMeshEmitOptions =
            DEFAULT_TRANSLATION_POLICY_MESH_EMIT_OPTS,
    ) {
        if (((opts.matrix ^ opts.inverse) >>> 0) !== 0xFFFF_FFFF) {
            throw new Error("translation policy mesh adapter requires a valid dipole");
        }
        if (opts.max_recursion <= 0) {
            throw new Error("max_recursion must be positive");
        }
    }

    callbacks(): TranslationPolicyMeshEmitCallbacks {
        return {
            claim_emit: (target, body) => this.emitClaim(target, body),
            raise_emit: (target, body) => this.emitCorroborationRaise(target, body),
            warrant_emit: (proposal) => this.emitWarrantProposal(proposal),
        };
    }

    emitClaim(target_peer_id: number, body_json: string): boolean {
        return this.enqueue(
            translationPolicyClaimPlasmid(target_peer_id, body_json, this.opts),
            "claims",
        );
    }

    emitCorroborationRaise(target_peer_id: number, body_json: string): boolean {
        return this.enqueue(
            translationPolicyCorroborationPlasmid(target_peer_id, body_json, this.opts),
            "raises",
        );
    }

    emitWarrantProposal(proposal: WarrantProposalPayload): boolean {
        return this.enqueue(
            translationPolicyWarrantPlasmid(proposal, this.opts),
            "warrants",
        );
    }

    telemetry(): TranslationPolicyMeshEmitTelemetry {
        return { ...this.stats };
    }

    private enqueue(
        plasmid: PlasmidPayload,
        kind: "claims" | "raises" | "warrants",
    ): boolean {
        try {
            this.mesh.enqueuePlasmid(plasmid);
            this.increment(kind, true);
            return true;
        } catch {
            this.increment(kind, false);
            return false;
        }
    }

    private increment(
        kind: "claims" | "raises" | "warrants",
        ok: boolean,
    ): void {
        const key = `${kind}_${ok ? "sent" : "failed"}` as keyof
            TranslationPolicyMeshEmitTelemetry;
        this.stats[key]++;
    }
}

export function createTranslationPolicyMeshEmitAdapter(
    mesh: TranslationPolicyMeshLike,
    opts: Partial<TranslationPolicyMeshEmitOptions> = {},
): TranslationPolicyMeshEmitAdapter {
    return new TranslationPolicyMeshEmitAdapter(mesh, mergeOptions(opts));
}

export function translationPolicyMeshEmitCallbacks(
    mesh: TranslationPolicyMeshLike,
    opts: Partial<TranslationPolicyMeshEmitOptions> = {},
): TranslationPolicyMeshEmitCallbacks {
    return createTranslationPolicyMeshEmitAdapter(mesh, opts).callbacks();
}

export function translationPolicyClaimPlasmid(
    target_peer_id: number,
    body_json: string,
    opts: Partial<TranslationPolicyMeshEmitOptions> = {},
): PlasmidPayload {
    return {
        ...baseTranslationPolicyPlasmid("TRANSLATION_POLICY", mergeOptions(opts)),
        translationPolicyTarget: target_peer_id >>> 0,
        translationPolicyBody: body_json,
    };
}

export function translationPolicyCorroborationPlasmid(
    target_peer_id: number,
    body_json: string,
    opts: Partial<TranslationPolicyMeshEmitOptions> = {},
): PlasmidPayload {
    return {
        ...baseTranslationPolicyPlasmid(
            "TRANSLATION_POLICY_CORROBORATION",
            mergeOptions(opts),
        ),
        translationPolicyCorroborationTarget: target_peer_id >>> 0,
        translationPolicyCorroborationBody: body_json,
    };
}

export function translationPolicyWarrantPlasmid(
    proposal: WarrantProposalPayload,
    opts: Partial<TranslationPolicyMeshEmitOptions> = {},
): PlasmidPayload {
    return {
        ...baseTranslationPolicyPlasmid("PROPOSAL", mergeOptions(opts)),
        proposalHash: proposal.proposalHash,
        proposalDescription: proposal.proposalDescription.slice(0, 64),
        parentHash: proposal.target_peer_id >>> 0,
    };
}

function baseTranslationPolicyPlasmid(
    semanticType: PlasmidPayload["semanticType"],
    opts: TranslationPolicyMeshEmitOptions,
): PlasmidPayload {
    return {
        attractorAddress: 0,
        matrix: opts.matrix >>> 0,
        inverse: opts.inverse >>> 0,
        pulseFreq: opts.pulse_freq >>> 0,
        pulseAmp: opts.pulse_amp >>> 0,
        semanticType,
        recursionDepth: 0,
        maxRecursion: opts.max_recursion >>> 0,
    };
}

function mergeOptions(
    opts: Partial<TranslationPolicyMeshEmitOptions>,
): TranslationPolicyMeshEmitOptions {
    const matrix = opts.matrix ?? DEFAULT_TRANSLATION_POLICY_MESH_EMIT_OPTS.matrix;
    return {
        ...DEFAULT_TRANSLATION_POLICY_MESH_EMIT_OPTS,
        ...opts,
        matrix: matrix >>> 0,
        inverse: (opts.inverse ?? (~matrix)) >>> 0,
    };
}
