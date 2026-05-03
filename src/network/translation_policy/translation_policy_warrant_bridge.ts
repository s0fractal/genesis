// 🌌 OMEGA-64: Era 1670 — Translation Policy Warrant Bridge
//
// Era 1650 detects translation-policy drift and Era 1660 carries
// those claims over the mesh. Era 1670 turns persistent drift into a
// normal Senate warrant proposal payload.
//
// This bridge does NOT issue warrants and does NOT quarantine peers.
// It only constructs the same `PROPOSAL` shape used by Era 1540 so the
// existing oracle gate can decide whether policy drift warrants action.

import {
    WarrantProposalPayload,
    senateHash,
} from "../quorum_warrant_bridge.ts";
import { TranslationPolicyDriftEvent } from "./translation_policy_monitor.ts";

export const TRANSLATION_POLICY_WARRANT_SCHEMA = "OMEGA-1670/v1";

export interface TranslationPolicyWarrantOptions {
    dedup_window_ms: number;
}

export const DEFAULT_TRANSLATION_POLICY_WARRANT_OPTS: TranslationPolicyWarrantOptions = {
    dedup_window_ms: 60_000,
};

export interface TranslationPolicyWarrantResult {
    payloads: WarrantProposalPayload[];
    deduped_peer_ids: number[];
}

/** Deterministic, ≤64-char Senate description for a policy drift
 *  warrant proposal. */
export function buildTranslationPolicyWarrantDescription(
    event: TranslationPolicyDriftEvent,
): string {
    const peer = (event.peer_id >>> 0).toString(16).padStart(8, "0");
    const local = (event.local_policy_hash >>> 0).toString(16).padStart(8, "0");
    const remote = (event.peer_policy_hash >>> 0).toString(16).padStart(8, "0");
    const out = `TPOL peer=0x${peer} local=0x${local} peerpol=0x${remote}`;
    return out.length > 64 ? out.slice(0, 64) : out;
}

export class TranslationPolicyWarrantBridge {
    private lastIssued = new Map<string, number>();

    constructor(
        public readonly opts: TranslationPolicyWarrantOptions =
            DEFAULT_TRANSLATION_POLICY_WARRANT_OPTS,
    ) {
        if (
            !Number.isFinite(opts.dedup_window_ms) ||
            opts.dedup_window_ms <= 0
        ) {
            throw new Error(
                "TranslationPolicyWarrantBridge: dedup_window_ms must be > 0",
            );
        }
    }

    issue(
        events: ReadonlyArray<TranslationPolicyDriftEvent>,
        now_ms: number,
    ): TranslationPolicyWarrantResult {
        const payloads: WarrantProposalPayload[] = [];
        const deduped: number[] = [];
        for (const event of events) {
            const key = this.dedupKey(event);
            const last = this.lastIssued.get(key) ?? 0;
            if (last !== 0 && now_ms - last < this.opts.dedup_window_ms) {
                deduped.push(event.peer_id >>> 0);
                continue;
            }
            const proposalDescription =
                buildTranslationPolicyWarrantDescription(event);
            payloads.push({
                semanticType: "PROPOSAL",
                proposalHash: senateHash(proposalDescription),
                proposalDescription,
                target_peer_id: event.peer_id >>> 0,
                issued_at_ms: now_ms,
            });
            this.lastIssued.set(key, now_ms);
        }
        return { payloads, deduped_peer_ids: deduped };
    }

    forget(event: TranslationPolicyDriftEvent): void {
        this.lastIssued.delete(this.dedupKey(event));
    }

    last_issued_snapshot(): Array<{
        key: string;
        last_issued_ms: number;
    }> {
        return [...this.lastIssued.entries()]
            .map(([key, last_issued_ms]) => ({ key, last_issued_ms }))
            .sort((a, b) => a.key.localeCompare(b.key));
    }

    private dedupKey(event: TranslationPolicyDriftEvent): string {
        return [
            event.peer_id >>> 0,
            event.local_policy_hash >>> 0,
            event.peer_policy_hash >>> 0,
        ].join(":");
    }
}
