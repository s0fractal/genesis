// 🌌 OMEGA-64: Era 1210 — Auto-Investigation Proposals
//
// Era 1200 surfaces partition alarms via PeerSnapshotMonitor. Era 1210
// closes the loop: each alarm AUTOMATICALLY raises a WARRANT_PROPOSAL
// (action_code = RELOCATE) targeting the suspected relay's ID. If three
// canonical oracles AYE the proposal, the Senate issues a formal
// investigation warrant; honest relays then DROP frames originating from
// the suspect relay until the warrant is cleared.
//
// This is the first time the lattice's transport-layer observations
// (Era 1110-1200) feed directly back into the Senate (Era 1030-1090).
// A partition that was a "signal" in Era 1200 becomes a "proposal" here,
// and a "ratified action" once oracles agree.
//
// SECURITY: an attacker who broadcasts a fake digest to trigger an
// investigation against a healthy relay must STILL convince three
// canonical oracles that the investigation is warranted. The Era 1080
// Codeicide gate ensures no single voice can RELOCATE another node;
// Era 1210 only AUTOMATES the proposal step, not the ratification.

import {
    PartitionAlarm,
} from "./peer_snapshot_monitor.ts";
import { ACTION_RELOCATE } from "./codeicide_law.ts";
import { computeProposalHash } from "./warrant_issuance.ts";
import { sha256_u32 } from "../sdk/phi_crypto.ts";

export interface InvestigationRecord {
    /** ID of the relay being investigated. */
    target_relay_id: number;
    /** Hash of the auto-raised WARRANT_PROPOSAL. */
    proposal_hash: number;
    /** Human-readable reason text fingerprinted into the proposal. */
    reason: string;
    /** Wall-clock ms when the proposal was raised. */
    raised_at_ms: number;
    /** Q16 measurement diff that triggered this investigation. */
    triggering_diff_q16: number;
    /** Status: "open" | "warranted" | "cleared". */
    status: "open" | "warranted" | "cleared";
}

export interface AutoInvestigatorOptions {
    /** Cooldown ms after raising a proposal before another for the same target. */
    cooldown_ms: number;
    /** Max ms an investigation stays "open" before auto-clearing. */
    open_window_ms: number;
    /** Optional callback fired on each new investigation raised. */
    on_proposal_raised?: (rec: InvestigationRecord) => void;
    /** Optional callback fired when an investigation transitions to "warranted". */
    on_warrant_issued?: (rec: InvestigationRecord) => void;
}

const DEFAULT_OPTS: AutoInvestigatorOptions = {
    cooldown_ms: 60_000,         // don't spam: 1 proposal per target per minute
    open_window_ms: 5 * 60_000,  // 5 minutes to ratify or auto-clear
};

/**
 * Build the canonical reason string for a partition-triggered investigation.
 * Deterministic so two relays observing the same alarm produce the same
 * proposal_hash — a key property of the Era 1090 deduplication invariant.
 */
export function buildInvestigationReason(alarm: PartitionAlarm): string {
    return `era1210/partition target=${alarm.relay_id.toString(16)} ` +
        `self_q16=${alarm.self_rate_q16} peer_q16=${alarm.peer_rate_q16} ` +
        `diff_q16=${alarm.diff_q16}`;
}

/**
 * AutoInvestigator listens to a stream of PartitionAlarms (typically
 * routed from PeerSnapshotMonitor.on_alarm) and raises WARRANT_PROPOSAL
 * objects. It does NOT directly cast votes — only the canonical oracles
 * may vote, via the existing Era 1090 flow.
 */
export class AutoInvestigator {
    private investigations: Map<number, InvestigationRecord> = new Map();
    private cooldowns: Map<number, number> = new Map();
    /** Set of suspect relay IDs whose frames honest relays should drop. */
    private quarantined: Set<number> = new Set();
    private opts: AutoInvestigatorOptions;

    constructor(opts: Partial<AutoInvestigatorOptions> = {}) {
        this.opts = { ...DEFAULT_OPTS, ...opts };
    }

    /**
     * Convert a PartitionAlarm into an InvestigationRecord, respecting
     * per-target cooldown. Returns null if cooldown blocks raising.
     */
    raiseFromAlarm(alarm: PartitionAlarm): InvestigationRecord | null {
        const cooled = this.cooldowns.get(alarm.relay_id) ?? 0;
        if (alarm.observed_at_ms < cooled + this.opts.cooldown_ms) {
            return null;
        }
        const reason = buildInvestigationReason(alarm);
        const proposal_hash = computeProposalHash(
            alarm.relay_id,
            ACTION_RELOCATE,
            reason,
        );
        const rec: InvestigationRecord = {
            target_relay_id: alarm.relay_id,
            proposal_hash,
            reason,
            raised_at_ms: alarm.observed_at_ms,
            triggering_diff_q16: alarm.diff_q16,
            status: "open",
        };
        this.investigations.set(proposal_hash, rec);
        this.cooldowns.set(alarm.relay_id, alarm.observed_at_ms);
        this.opts.on_proposal_raised?.(rec);
        return rec;
    }

    /**
     * Mark an investigation as warranted (Senate ratified). Caller invokes
     * this when the WarrantLedger transitions the proposal_hash to ISSUED.
     * Adds the target relay to the quarantine set.
     */
    markWarranted(proposal_hash: number): void {
        const rec = this.investigations.get(proposal_hash);
        if (!rec) return;
        if (rec.status !== "open") return;
        rec.status = "warranted";
        this.quarantined.add(rec.target_relay_id);
        this.opts.on_warrant_issued?.(rec);
    }

    /**
     * Clear an investigation (operator override or natural expiry).
     * Removes the target relay from quarantine.
     */
    markCleared(proposal_hash: number): void {
        const rec = this.investigations.get(proposal_hash);
        if (!rec) return;
        rec.status = "cleared";
        this.quarantined.delete(rec.target_relay_id);
    }

    /**
     * Auto-clear investigations that have been "open" longer than
     * `open_window_ms`. Returns the count of records cleared.
     */
    sweepStale(now_ms: number): number {
        let cleared = 0;
        for (const rec of this.investigations.values()) {
            if (rec.status === "open"
                && (now_ms - rec.raised_at_ms) >= this.opts.open_window_ms) {
                rec.status = "cleared";
                cleared++;
            }
        }
        return cleared;
    }

    /** True iff the relay is currently quarantined (has a warranted investigation). */
    isQuarantined(relay_id: number): boolean {
        return this.quarantined.has(relay_id);
    }

    /** All current investigation records, newest-first. */
    list(): InvestigationRecord[] {
        return [...this.investigations.values()].sort(
            (a, b) => b.raised_at_ms - a.raised_at_ms,
        );
    }

    /** Investigation records by status. */
    listByStatus(status: InvestigationRecord["status"]): InvestigationRecord[] {
        return this.list().filter(r => r.status === status);
    }

    /** All quarantined relay IDs (sorted ascending). */
    quarantinedRelays(): number[] {
        return [...this.quarantined].sort((a, b) => a - b);
    }

    /** Test/reset helper. */
    clear(): void {
        this.investigations.clear();
        this.cooldowns.clear();
        this.quarantined.clear();
    }
}

/**
 * A frame-boundary helper: returns true iff the frame should be dropped
 * because its origin relay is currently quarantined.
 *
 * `frame_origin_id` is the relay ID extracted from the frame's
 * `proposal_or_target` slot for SNAPSHOT_DIGEST frames, or from its
 * trail digest for other types (caller-supplied).
 */
export function shouldDropFrameFromOrigin(
    investigator: AutoInvestigator,
    frame_origin_id: number,
): boolean {
    return investigator.isQuarantined(frame_origin_id);
}

/**
 * Compute a stable relay_id from a relay name string. Used by relays
 * to derive their own ID and by observers to match alarms back to
 * specific relays.
 */
export function relayIdFromName(name: string): number {
    const enc = new TextEncoder();
    return sha256_u32(enc.encode(name));
}
