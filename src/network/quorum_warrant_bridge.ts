// 🌌 OMEGA-64: Era 1540 — Auto-Warrant Issuance from Quorum Trigger
//
// Era 1530's `QuorumInvestigationTrigger` returns peer_ids that
// have crossed the band/duration/cooldown thresholds and are
// candidates for forensic investigation. Era 1540 turns each
// candidate into a `WARRANT_PROPOSAL` payload — the same plasmid
// shape Era 1090 already routes through the 3-of-5 oracle warrant
// gate.
//
// THIS MODULE'S CONTRACT:
//   • Consume `fire_now` peer_ids from a TriggerOutcome.
//   • For each, build a deterministic `WarrantProposalPayload`
//     with a FNV-1a-derived proposalHash over a stable description.
//   • Return the payloads; caller wires them into whatever
//     plasmid emit pipeline they own (mesh.enqueuePlasmid,
//     test fakes, etc.).
//
// Pure: no I/O, no hidden state. The only state is the dedup
// memory of recently-issued warrants so the same peer doesn't
// get a fresh warrant proposal on every tick within a window.
// (Era 1530's `markTriggered` already gates re-fires at the
// upstream layer, but this module adds an extra defense-in-depth
// dedup keyed by description+peer in case the caller's wiring
// loses a markTriggered call.)
//
// COMPATIBILITY: the proposalHash is computed via the same
// FNV-1a-over-64-byte-padded-description function used by
// `WebRTCV2Mesh.senateHash`, so warrants emitted by this bridge
// flow through the existing Era 1090 validation logic unchanged.

import { sha256_u32 } from "../sdk/phi_crypto.ts";
import { TriggerOutcome } from "./quorum_investigation.ts";

export const WARRANT_BRIDGE_SCHEMA = "OMEGA-1540/v1";

/** Subset of `PlasmidPayload` fields relevant to a quorum-driven
 *  warrant proposal. Callers merge these into a full plasmid
 *  template (with attractorAddress, matrix, etc.) before
 *  enqueuing. */
export interface WarrantProposalPayload {
    semanticType: "PROPOSAL";
    proposalHash: string;
    proposalDescription: string;
    /** The peer this warrant is targeting (informational; the
     *  receiver re-derives via senateHash check). */
    target_peer_id: number;
    /** When this proposal was generated. */
    issued_at_ms: number;
}

/** Compute the senate-compatible 64-byte-padded SHA-256 hash. */
export async function senateHash(description: string): Promise<string> {
    const enc = new TextEncoder();
    const raw = enc.encode(description);
    const buf = new Uint8Array(64);
    const n = Math.min(raw.length, 64);
    for (let i = 0; i < n; i++) buf[i] = raw[i];
    const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
    const hashArray = new Uint8Array(hashBuffer);
    let hex = "";
    for (let i = 0; i < hashArray.length; i++) {
        hex += hashArray[i].toString(16).padStart(2, "0");
    }
    return hex;
}

/** Build a deterministic, ≤64-char description for an
 *  investigation proposal. Format:
 *
 *    "INV peer=0x{peer:08x} consensus=0x{anchor:08x}"
 *
 *  Truncated to 64 chars defensively (the senateHash function
 *  pads/truncates, so out-of-range descriptions would still hash
 *  but downstream debug logs prefer compact strings). */
export function buildWarrantDescription(
    peer_id: number,
    consensus_anchor: number,
): string {
    const peerHex = (peer_id >>> 0).toString(16).padStart(8, "0");
    const anchorHex = (consensus_anchor >>> 0).toString(16).padStart(8, "0");
    const out = `INV peer=0x${peerHex} consensus=0x${anchorHex}`;
    return out.length > 64 ? out.slice(0, 64) : out;
}

export interface BridgeOptions {
    /** Two warrants for the same peer issued less than this
     *  many ms apart are deduplicated (the second one is
     *  silently skipped). */
    dedup_window_ms: number;
}

export const DEFAULT_BRIDGE_OPTS: BridgeOptions = {
    dedup_window_ms: 60_000,
};

export interface BridgeIssueResult {
    /** Newly-built proposal payloads, ready for emit. */
    payloads: WarrantProposalPayload[];
    /** Peers that were in `fire_now` but skipped due to dedup. */
    deduped_peer_ids: number[];
}

export class QuorumWarrantBridge {
    /** Last-issued timestamp per peer for dedup. */
    private last_issued = new Map<number, number>();

    constructor(public readonly opts: BridgeOptions = DEFAULT_BRIDGE_OPTS) {
        if (!Number.isFinite(opts.dedup_window_ms) || opts.dedup_window_ms <= 0) {
            throw new Error(`QuorumWarrantBridge: dedup_window_ms must be > 0`);
        }
    }

    /** Build warrant proposals for the given trigger outcome.
     *  `consensus_anchor` is the consensus value at the time of
     *  the trigger, used to make each warrant's description
     *  uniquely identifiable. */
    async issue(
        outcome: TriggerOutcome,
        consensus_anchor: number,
        now_ms: number,
    ): Promise<BridgeIssueResult> {
        const payloads: WarrantProposalPayload[] = [];
        const deduped: number[] = [];
        for (const peer_id of outcome.fire_now) {
            const last = this.last_issued.get(peer_id >>> 0) ?? 0;
            if (last !== 0 && now_ms - last < this.opts.dedup_window_ms) {
                deduped.push(peer_id);
                continue;
            }
            const description = buildWarrantDescription(peer_id, consensus_anchor);
            const proposalHash = await senateHash(description);
            payloads.push({
                semanticType: "PROPOSAL",
                proposalHash,
                proposalDescription: description,
                target_peer_id: peer_id >>> 0,
                issued_at_ms: now_ms,
            });
            this.last_issued.set(peer_id >>> 0, now_ms);
        }
        return { payloads, deduped_peer_ids: deduped };
    }

    /** Manual dedup-state reset for a peer (e.g. after the
     *  warrant was rejected or quarantine resolved). */
    forget(peer_id: number): void {
        this.last_issued.delete(peer_id >>> 0);
    }

    /** Diagnostic snapshot of last-issued timestamps. */
    last_issued_snapshot(): Array<{ peer_id: number; last_issued_ms: number }> {
        return [...this.last_issued.entries()]
            .map(([peer_id, last_issued_ms]) => ({ peer_id, last_issued_ms }))
            .sort((a, b) => a.peer_id - b.peer_id);
    }
}
