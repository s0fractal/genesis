// OMEGA-64: Era 1880 - Translation Policy Replay Digest Quorum
//
// Era 1870 lets peers announce compact replay interpretation anchors.
// This tracker makes those claims observable as a deterministic quorum:
// which digest is currently consensus, how strong that agreement is,
// and which peers dissent.

import type {
    TranslationPolicyReplayDigestClaim,
} from "./translation_policy_replay_digest_claim.ts";

export const TRANSLATION_POLICY_REPLAY_DIGEST_QUORUM_SCHEMA = "OMEGA-1880/v1";

export type ReplayDigestQuorumBand =
    | "none"
    | "lone"
    | "double"
    | "triple+"
    | "high";

export interface ReplayDigestClaimObservation {
    peer_id: number;
    claim: TranslationPolicyReplayDigestClaim;
    observed_at_ms: number;
}

export interface ReplayDigestQuorumSnapshot {
    schema: string;
    consensus_digest: number | null;
    consensus_count: number;
    total_claims: number;
    band: ReplayDigestQuorumBand;
    dissenter_peer_ids: number[];
    distinct_digests: number[];
    agreement_q16: number;
    consensus_claim: TranslationPolicyReplayDigestClaim | null;
}

export interface ReplayDigestQuorumOptions {
    ttl_ms: number;
    high_threshold: number;
}

export const DEFAULT_REPLAY_DIGEST_QUORUM_OPTS: ReplayDigestQuorumOptions = {
    ttl_ms: 5 * 60 * 1000,
    high_threshold: 3,
};

export class TranslationPolicyReplayDigestQuorumTracker {
    private observations = new Map<number, ReplayDigestClaimObservation>();

    constructor(
        public readonly opts: ReplayDigestQuorumOptions =
            DEFAULT_REPLAY_DIGEST_QUORUM_OPTS,
    ) {
        if (!Number.isFinite(opts.ttl_ms) || opts.ttl_ms <= 0) {
            throw new Error(
                `TranslationPolicyReplayDigestQuorumTracker: ttl_ms must be positive: ${opts.ttl_ms}`,
            );
        }
        if (!Number.isFinite(opts.high_threshold) || opts.high_threshold < 2) {
            throw new Error(
                `TranslationPolicyReplayDigestQuorumTracker: high_threshold must be ≥ 2: ${opts.high_threshold}`,
            );
        }
    }

    observe(
        claim: TranslationPolicyReplayDigestClaim,
        now_ms: number = claim.claimed_at_ms,
    ): void {
        const pid = claim.peer_id >>> 0;
        this.observations.set(pid, {
            peer_id: pid,
            claim: normalizeClaim(claim),
            observed_at_ms: now_ms,
        });
    }

    forget(peer_id: number): void {
        this.observations.delete(peer_id >>> 0);
    }

    clear(): void {
        this.observations.clear();
    }

    peerCount(now_ms: number): number {
        this.evict(now_ms);
        return this.observations.size;
    }

    claimsForDigest(
        digest: number,
        now_ms: number,
    ): TranslationPolicyReplayDigestClaim[] {
        this.evict(now_ms);
        const d = digest >>> 0;
        return [...this.observations.values()]
            .filter((obs) => obs.claim.digest === d)
            .map((obs) => obs.claim)
            .sort((a, b) => a.peer_id - b.peer_id);
    }

    snapshot(now_ms: number): ReplayDigestQuorumSnapshot {
        this.evict(now_ms);
        if (this.observations.size === 0) {
            return {
                schema: TRANSLATION_POLICY_REPLAY_DIGEST_QUORUM_SCHEMA,
                consensus_digest: null,
                consensus_count: 0,
                total_claims: 0,
                band: "none",
                dissenter_peer_ids: [],
                distinct_digests: [],
                agreement_q16: 0,
                consensus_claim: null,
            };
        }

        const counts = new Map<number, number>();
        const firstClaims = new Map<number, TranslationPolicyReplayDigestClaim>();
        for (const obs of this.observations.values()) {
            const digest = obs.claim.digest >>> 0;
            counts.set(digest, (counts.get(digest) ?? 0) + 1);
            const existing = firstClaims.get(digest);
            if (!existing || obs.claim.peer_id < existing.peer_id) {
                firstClaims.set(digest, obs.claim);
            }
        }

        let consensusDigest = 0;
        let consensusCount = 0;
        for (const [digest, count] of counts) {
            if (
                count > consensusCount ||
                (count === consensusCount && digest < consensusDigest)
            ) {
                consensusDigest = digest;
                consensusCount = count;
            }
        }

        const dissenters: number[] = [];
        for (const obs of this.observations.values()) {
            if (obs.claim.digest !== consensusDigest) {
                dissenters.push(obs.peer_id);
            }
        }
        dissenters.sort((a, b) => a - b);
        const total = this.observations.size;
        return {
            schema: TRANSLATION_POLICY_REPLAY_DIGEST_QUORUM_SCHEMA,
            consensus_digest: consensusDigest,
            consensus_count: consensusCount,
            total_claims: total,
            band: classifyReplayDigestQuorumBand(
                consensusCount,
                this.opts.high_threshold,
            ),
            dissenter_peer_ids: dissenters,
            distinct_digests: [...counts.keys()].sort((a, b) => a - b),
            agreement_q16: Math.round((consensusCount / total) * 65536),
            consensus_claim: firstClaims.get(consensusDigest) ?? null,
        };
    }

    consensusDigest(now_ms: number): number | null {
        return this.snapshot(now_ms).consensus_digest;
    }

    dissenters(now_ms: number): number[] {
        return this.snapshot(now_ms).dissenter_peer_ids;
    }

    private evict(now_ms: number): void {
        const cutoff = now_ms - this.opts.ttl_ms;
        for (const [pid, obs] of this.observations) {
            if (obs.observed_at_ms < cutoff) {
                this.observations.delete(pid);
            }
        }
    }
}

export function classifyReplayDigestQuorumBand(
    count: number,
    high_threshold: number,
): ReplayDigestQuorumBand {
    if (count <= 0) return "none";
    if (count === 1) return "lone";
    if (count === 2) return "double";
    if (count >= high_threshold) return "high";
    return "triple+";
}

export function replayDigestQuorumBandAtLeast(
    actual: ReplayDigestQuorumBand,
    required: ReplayDigestQuorumBand,
): boolean {
    const rank: Record<ReplayDigestQuorumBand, number> = {
        none: 0,
        lone: 1,
        double: 2,
        "triple+": 3,
        high: 4,
    };
    return rank[actual] >= rank[required];
}

export function replayDigestQuorumGlyph(
    band: ReplayDigestQuorumBand,
): string {
    switch (band) {
        case "high":
        case "triple+":
            return "G";
        case "double":
            return "Y";
        case "lone":
            return "O";
        case "none":
            return "-";
    }
}

function normalizeClaim(
    claim: TranslationPolicyReplayDigestClaim,
): TranslationPolicyReplayDigestClaim {
    return {
        ...claim,
        peer_id: claim.peer_id >>> 0,
        witness_id: claim.witness_id >>> 0,
        digest: claim.digest >>> 0,
        band_timeline_hash: claim.band_timeline_hash >>> 0,
        policy_interval_hash: claim.policy_interval_hash >>> 0,
        error_window_hash: claim.error_window_hash >>> 0,
        classified_events: claim.classified_events >>> 0,
        malformed_payloads: claim.malformed_payloads >>> 0,
        final_policy_hash: claim.final_policy_hash >>> 0,
    };
}
