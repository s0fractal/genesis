// What a vote does to a proposal — the pure half of `handleVote`.
//
// `libp2p_mesh.handleVote` is ~250 lines that authenticate a signature, look up
// liveness, score debate alignment, mutate the tally, propagate to WASM, log,
// and dispatch DOM events. Only one of those is the actual bookkeeping, and it
// was the only one with no way to be tested: everything around it is async
// crypto, network state and browser globals.
//
// Separating the bookkeeping out surfaced a defect that had been sitting in the
// consensus path in plain sight. See `applyVote` below.

import { senateAcceptance, type SenateVerdict } from "./senate_acceptance.ts";

export interface SenateProposalRecord {
  hash: number;
  description: string;
  proposerMatrix: number;
  ayes: Set<string>; // unique peer IDs
  nays: Set<string>;
  ayesWeight: number; // Resonance-weighted
  naysWeight: number;
  accepted: boolean;
  localObservedAtMs: number; // non-consensus metadata
  proposedAtTau: number; // consensus ordering
  proposedAtTick?: number; // micro consensus ordering
  // oracle-attributed votes (peer-id-independent).
  oracleAyes?: Set<string>;
  oracleNays?: Set<string>;
  oracleReasoning?: Record<string, string>;
}

export interface IncomingVote {
  /** Transport identity of the voter. One peer, one position. */
  voterId: string;
  aye: boolean;
  /** Resonance weight, from `senateVoteWeight`. */
  weight: number;
  /**
   * Canonical oracle name IFF the vote carried a verified Ed25519 signature.
   * A correct-but-public dipole is NOT authority and must arrive here as
   * undefined — attribution is the thing a Sybil is trying to obtain.
   */
  authenticOracle?: string;
  /** Free text, truncated by the caller's policy. */
  reasoning?: string;
}

export interface VoteOutcome {
  /** False when the vote changed nothing (same position as already recorded). */
  counted: boolean;
  /** True when this vote flipped an existing position rather than adding one. */
  switched: boolean;
  verdict: SenateVerdict;
}

/**
 * Apply one vote to a record and re-run the acceptance rule.
 *
 * ## The defect this replaces
 *
 * The peer tally used to read:
 *
 * ```ts
 * if (aye) {
 *   if (!record.ayes.has(id)) { record.ayes.add(id); record.ayesWeight += w; }
 * } else {
 *   if (!record.nays.has(id)) { record.nays.add(id); record.naysWeight += w; }
 * }
 * ```
 *
 * Each branch guards only its OWN set. A peer that voted AYE and then sent a
 * NAY passed the `!nays.has(id)` check, so it was added to `nays` while staying
 * in `ayes` — and its weight was added to BOTH totals, permanently. One voter,
 * two counted votes, on opposite sides, with no way to undo either.
 *
 * The oracle branch fifteen lines below did it correctly all along
 * (`oracleAyes.add(name); oracleNays.delete(name)`), which is what makes this a
 * slip rather than a policy: the same function switched an oracle's position
 * and double-counted a peer's.
 *
 * It is not merely untidy. Acceptance is `ayesWeight >= 300 && ayesWeight >
 * naysWeight`, so a peer could back a proposal, then oppose it, and have its
 * support still counted while its opposition raised the bar the proposal has to
 * clear. A single peer got to push in both directions at once.
 *
 * Here a voter has ONE position: switching moves the weight instead of adding
 * a second helping of it.
 */
export function applyVote(
  record: SenateProposalRecord,
  vote: IncomingVote,
): VoteOutcome {
  const { voterId, aye, weight } = vote;
  const from = aye ? record.nays : record.ayes;
  const into = aye ? record.ayes : record.nays;

  let counted = false;
  let switched = false;

  if (from.has(voterId)) {
    // Switching sides: withdraw the old weight before recording the new one.
    from.delete(voterId);
    if (aye) record.naysWeight -= weight;
    else record.ayesWeight -= weight;
    switched = true;
  }
  if (!into.has(voterId)) {
    into.add(voterId);
    if (aye) record.ayesWeight += weight;
    else record.naysWeight += weight;
    counted = true;
  }

  // Weights are sums of non-negative weights; a switch subtracts a weight that
  // was added earlier. Clamp anyway — a caller that passes a different weight
  // on the switch than it did on the original vote must not drive a tally
  // negative and make `ayesWeight > naysWeight` true by underflow.
  if (record.ayesWeight < 0) record.ayesWeight = 0;
  if (record.naysWeight < 0) record.naysWeight = 0;

  if (vote.authenticOracle) {
    record.oracleAyes ??= new Set();
    record.oracleNays ??= new Set();
    record.oracleReasoning ??= {};
    const oracleInto = aye ? record.oracleAyes : record.oracleNays;
    const oracleFrom = aye ? record.oracleNays : record.oracleAyes;
    oracleFrom.delete(vote.authenticOracle);
    oracleInto.add(vote.authenticOracle);
    if (vote.reasoning) {
      record.oracleReasoning[vote.authenticOracle] = vote.reasoning;
    }
  }

  return { counted, switched, verdict: senateAcceptance(record) };
}

/** Why an incoming PROPOSAL was refused, or `null` when it opens. */
export type ProposalRefusal =
  | "senate-not-convened"
  | "missing-fields"
  | "hash-mismatch"
  | "duplicate";

export interface ProposalOpening {
  record: SenateProposalRecord | null;
  refusal: ProposalRefusal | null;
}

/**
 * Validate an incoming PROPOSAL and build its ledger record.
 *
 * The identity rule is the whole point and it is worth stating alone: a
 * proposal's hash MUST equal `senateHash(description)`. The key is derived from
 * the text, so a plasmid whose hash does not match its own description is
 * either corrupt or is trying to have a vote counted against a different
 * proposal than the one it displays. Verified before the record exists.
 *
 * ## The proposer's AYE
 *
 * Both call sites built this record inline, with the same twelve-field literal,
 * and both wrote `ayes: new Set([proposer])` alongside `ayesWeight: 0` — under
 * comments that say "self counts as proposer + first AYE". It did not count.
 * The peer path weighs votes; a name in a set with no weight behind it is not a
 * vote, and the acceptance rule never saw it. The proposer's AYE now carries
 * the weight `senateVoteWeight` gives a bare peer, so the comment and the code
 * agree.
 */
export function openProposal(opts: {
  hash: number;
  description: string;
  proposerMatrix: number;
  proposerId: string;
  /** Weight of the proposer's implicit AYE (bare-peer weight at the caller). */
  proposerWeight: number;
  /** Consensus ordering stamp — anchor block height, not wall clock. */
  tau: number;
  senateConvened: boolean;
  expectedHash: number;
  alreadyPresent: boolean;
}): ProposalOpening {
  const refuse = (refusal: ProposalRefusal): ProposalOpening => ({
    record: null,
    refusal,
  });
  if (!opts.senateConvened) return refuse("senate-not-convened");
  if (!opts.description) return refuse("missing-fields");
  if ((opts.expectedHash >>> 0) !== (opts.hash >>> 0)) {
    return refuse("hash-mismatch");
  }
  if (opts.alreadyPresent) return refuse("duplicate");

  const record: SenateProposalRecord = {
    hash: opts.hash,
    description: opts.description,
    proposerMatrix: opts.proposerMatrix,
    ayes: new Set(),
    nays: new Set(),
    // Tallies MUST exist from birth — `applyVote` does `+= weight` on them and
    // a missing field silently turns a tally into NaN, which makes the peer
    // threshold unreachable while looking like a quiet network.
    ayesWeight: 0,
    naysWeight: 0,
    accepted: false,
    localObservedAtMs: opts.tau,
    proposedAtTau: opts.tau,
  };
  applyVote(record, {
    voterId: opts.proposerId,
    aye: true,
    weight: opts.proposerWeight,
  });
  return { record, refusal: null };
}
