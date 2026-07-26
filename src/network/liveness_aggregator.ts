// Liveness Telemetry Aggregator

// A relay-side observer that consumes HEARTBEAT frames from N bare-metal
// spores and classifies each one's health. Used by browser/Deno relays
// to render an operational HUD ("3 of 5 spores are healthy, 1 is forked,
// 1 stalled") and to surface anchor-drift incidents the moment they
// happen.

// HEALTH CLASSES:
// - HEALTHY:    seen recently AND advancing tick AND genesis = 0x716EA2F8
// - STALLED:    seen recently BUT tick has not advanced for ≥ stallTicks
// - FORKED:     genesis_hash != 0x716EA2F8 (anchor drift — non-conforming impl)
// - LOST:       last_seen_at_ms is older than maxSilenceMs
// - UNKNOWN:    seen ≥ once but not enough samples to classify

// NB: this layer trusts the wire format (CRC validated by frameFromBytes
// at the boundary) but does NOT trust the spore's claimed identity. A
// spore that broadcasts a wrong genesis_hash is FORKED, not impostor.
// Codeicide Law plus the warrant issuance flow handle authenticity at
// higher layers.

import { GENESIS_HASH_LEGACY_V1_0 } from "./genesis_inscription.ts";
import {
  FRAME_TYPE_HEARTBEAT,
  FRAME_TYPE_WARRANT_VOTE,
  SporeFrame,
} from "./spore_frame.ts";

export type SporeHealth =
  | "healthy"
  | "stalled"
  | "forked"
  | "lost"
  | "unknown";

export interface SporeRecord {
  spore_id: string;
  last_genesis: number;
  last_tick: number;
  last_tick_advanced_at_ms: number;
  last_seen_at_ms: number;
  heartbeat_count: number;
  warrant_votes_observed: number;
  health: SporeHealth;
  /** Most recent vote bitmask we've witnessed this spore's relay forward. */
  last_vote_oracle_bit: number;
}

export interface AggregatorOptions {
  /** Ticks of zero advancement that flips a spore to "stalled". */
  stallTicks: number;
  /** Wall-clock ms without any frame that flips a spore to "lost". */
  maxSilenceMs: number;
  /** Minimum heartbeat count before classifying away from "unknown". */
  classifyAfter: number;
}

const DEFAULT_OPTS: AggregatorOptions = {
  stallTicks: 0, // any consecutive identical tick → stall (the spore IS its tick)
  maxSilenceMs: 30_000,
  classifyAfter: 2,
};

export class LivenessAggregator {
  private spores: Map<string, SporeRecord> = new Map();
  private opts: AggregatorOptions;

  constructor(opts: Partial<AggregatorOptions> = {}) {
    this.opts = { ...DEFAULT_OPTS, ...opts };
  }

  /**
   * Ingest a parsed frame from `spore_id`. Returns the (possibly
   * mutated) record.
   */
  ingest(spore_id: string, frame: SporeFrame, now_ms: number): SporeRecord {
    let rec = this.spores.get(spore_id);
    if (!rec) {
      rec = {
        spore_id,
        last_genesis: 0,
        last_tick: 0,
        last_tick_advanced_at_ms: now_ms,
        last_seen_at_ms: now_ms,
        heartbeat_count: 0,
        warrant_votes_observed: 0,
        health: "unknown",
        last_vote_oracle_bit: 0xFF,
      };
      this.spores.set(spore_id, rec);
    }
    rec.last_seen_at_ms = now_ms;

    if (frame.frameType === FRAME_TYPE_HEARTBEAT) {
      rec.heartbeat_count += 1;
      // proposalOrTarget on a HEARTBEAT carries the genesis hash.
      rec.last_genesis = frame.proposalOrTarget >>> 0;
      // Tick advancement check.
      if (frame.tick > rec.last_tick) {
        rec.last_tick = frame.tick;
        rec.last_tick_advanced_at_ms = now_ms;
      }
      // First heartbeat is always tick=0; treat the very first
      // arrival as having advanced.
      if (rec.heartbeat_count === 1) {
        rec.last_tick_advanced_at_ms = now_ms;
      }
    } else if (frame.frameType === FRAME_TYPE_WARRANT_VOTE) {
      rec.warrant_votes_observed += 1;
      rec.last_vote_oracle_bit = frame.oracleBit;
    }

    rec.health = this.classify(rec, now_ms);
    return rec;
  }

  /** Re-classify a record without ingesting a new frame. */
  classify(rec: SporeRecord, now_ms: number): SporeHealth {
    // FORKED dominates — wrong anchor means non-conforming impl.
    if (
      rec.heartbeat_count > 0 && rec.last_genesis !== GENESIS_HASH_LEGACY_V1_0
    ) {
      return "forked";
    }
    // LOST: silent for too long.
    if ((now_ms - rec.last_seen_at_ms) > this.opts.maxSilenceMs) {
      return "lost";
    }
    // UNKNOWN until we have enough samples.
    if (rec.heartbeat_count < this.opts.classifyAfter) {
      return "unknown";
    }
    // STALLED: tick has not advanced beyond stallTicks since last bump.
    // We treat "received N+1 heartbeats with the same tick" as a stall.
    if (
      rec.heartbeat_count >= 2 &&
      rec.last_tick_advanced_at_ms === rec.last_seen_at_ms
    ) {
      // we just advanced — not stalled
    }
    const since_advance = rec.last_seen_at_ms - rec.last_tick_advanced_at_ms;
    if (
      since_advance > 0 && rec.heartbeat_count >= this.opts.classifyAfter + 1
    ) {
      // Multiple heartbeats observed without a tick increase → stalled.
      return "stalled";
    }
    return "healthy";
  }

  /** Re-classify EVERY tracked spore (e.g. on a HUD refresh tick). */
  sweep(now_ms: number): void {
    for (const rec of this.spores.values()) {
      rec.health = this.classify(rec, now_ms);
    }
  }

  snapshot(): SporeRecord[] {
    return [...this.spores.values()];
  }

  countByHealth(): Record<SporeHealth, number> {
    const out: Record<SporeHealth, number> = {
      healthy: 0,
      stalled: 0,
      forked: 0,
      lost: 0,
      unknown: 0,
    };
    for (const r of this.spores.values()) out[r.health]++;
    return out;
  }

  /** Returns the spore IDs whose anchor differs from v1.0 — these are
   *  candidates for protocol-amendment proposals (or for being kicked). */
  forkedSpores(): string[] {
    const out: string[] = [];
    for (const r of this.spores.values()) {
      if (r.health === "forked") out.push(r.spore_id);
    }
    return out;
  }

  forget(spore_id: string): boolean {
    return this.spores.delete(spore_id);
  }
}
