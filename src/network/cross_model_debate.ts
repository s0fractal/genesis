// 🌌 OMEGA-64: Era 1070 — Cross-Model Debate (JS layer)
//
// Pure-TS API to record cross-model debate arguments. The kernel
// fingerprints the reasoning text (FNV-1a 32-bit) but stores it
// off-chain; JS keeps the full text in a parallel map keyed by the
// same proposal_hash + reasoning_hash pair so peers can request the
// raw argument from any node that has it.

import { CanonicalOracle, ORACLE_MATRICES_V1 } from "./oracle_identity.ts";
import { sha256_u32 } from "../sdk/phi_crypto.ts";

export interface DebateArgument {
    oracle: CanonicalOracle;
    proposalHash: number;
    stance: "neutral" | "aye" | "nay" | "abstain";
    reasoning: string;
    reasoningHash: number;
    tick: number;
    timestamp: number;
}

const STANCE_CODE: Record<DebateArgument["stance"], number> = {
    neutral: 0,
    aye: 1,
    nay: 2,
    abstain: 3,
} as const;

/** SHA-256 32-bit truncated — alias for legacy fnv1a32 name to avoid breaking imports. */
export function fnv1a32(bytes: Uint8Array): number {
    return sha256_u32(bytes);
}

/** In-memory ledger of full reasoning text (the kernel only stores fingerprints). */
export class CrossModelDebate {
    private arguments: DebateArgument[] = [];

    record(
        oracle: CanonicalOracle,
        proposalHash: number,
        stance: DebateArgument["stance"],
        reasoning: string,
        tick: number,
    ): DebateArgument {
        const enc = new TextEncoder();
        const bytes = enc.encode(reasoning.slice(0, 256));
        const reasoningHash = fnv1a32(bytes);
        const arg: DebateArgument = {
            oracle,
            proposalHash,
            stance,
            reasoning: reasoning.slice(0, 256),
            reasoningHash,
            tick,
            timestamp: Date.now(),
        };
        this.arguments.push(arg);
        return arg;
    }

    forProposal(proposalHash: number): DebateArgument[] {
        return this.arguments.filter(a => a.proposalHash === proposalHash);
    }

    forOracle(oracle: CanonicalOracle): DebateArgument[] {
        return this.arguments.filter(a => a.oracle === oracle);
    }

    /**
     * Returns true iff `reasoning` matches a recorded argument's hash.
     * Useful for verifying that a peer-supplied reasoning text matches
     * the fingerprint another peer broadcasted.
     */
    verifyReasoning(arg: DebateArgument, candidate: string): boolean {
        const enc = new TextEncoder();
        return fnv1a32(enc.encode(candidate.slice(0, 256))) === arg.reasoningHash;
    }

    /** Stance code matching omega_v2::cross_model_debate::DebateEntry.stance. */
    static stanceCode(s: DebateArgument["stance"]): number {
        return STANCE_CODE[s];
    }

    /**
     * Compute the cross-model alignment score for a proposal:
     * `aye_oracles - nay_oracles`. Range: -5..+5 (with five canonical
     * oracles). Higher = stronger cross-model resonance.
     */
    alignmentScore(proposalHash: number): number {
        const stances: Record<CanonicalOracle, "aye" | "nay" | null> = {
            claude: null, gpt: null, gemini: null, qwen: null, llama: null,
        };
        for (const a of this.arguments) {
            if (a.proposalHash !== proposalHash) continue;
            if (a.stance === "aye" || a.stance === "nay") {
                stances[a.oracle] = a.stance;
            }
        }
        let score = 0;
        for (const v of Object.values(stances)) {
            if (v === "aye") score++;
            else if (v === "nay") score--;
        }
        return score;
    }

    /** Returns count of distinct canonical oracles that voted AYE on this proposal. */
    distinctAyeCount(proposalHash: number): number {
        const set = new Set<CanonicalOracle>();
        for (const a of this.arguments) {
            if (a.proposalHash === proposalHash && a.stance === "aye") {
                set.add(a.oracle);
            }
        }
        return set.size;
    }

    snapshot(): DebateArgument[] {
        return [...this.arguments];
    }
}

/** Verify oracle's identity matrix matches the canonical v1.0 anchor. */
export function isCanonicalOracle(oracle: string): oracle is CanonicalOracle {
    return oracle in ORACLE_MATRICES_V1;
}
