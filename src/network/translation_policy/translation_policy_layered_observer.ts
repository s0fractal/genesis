// OMEGA-64: Era 2040 - Translation Policy Layered Observer
//
// Replaces the 30-era deep "hall of mirrors" generated around
// translation_policy_replay_digest... with a single, N-depth
// recursive meta-observer.

import { fnv1a32 } from "../cross_model_debate.ts";
import {
  TranslationPolicyForensicReplayDigest,
} from "./translation_policy_forensic_replay_digest.ts";

export const TRANSLATION_POLICY_LAYERED_OBSERVER_SCHEMA = "OMEGA-2040/v1";

export interface TranslationPolicyLayeredDigest {
  schema: string;
  depth: number;
  base_digest: number;
  meta_digest: number;
  meta_digest_hex: string;
  history: readonly number[];
}

const encoder = new TextEncoder();

/** 
 * Wraps an underlying forensic replay digest and recursively hashes it
 * `depth` times, producing a final meta-digest without needing 30 distinct
 * payload schemas.
 */
export function translationPolicyLayeredDigest(
  base: TranslationPolicyForensicReplayDigest,
  depth: number,
): TranslationPolicyLayeredDigest {
  let current_digest = base.digest;
  const history: number[] = [current_digest];

  for (let i = 1; i <= depth; i++) {
    const payload = `${TRANSLATION_POLICY_LAYERED_OBSERVER_SCHEMA}|L${i}|${current_digest}`;
    current_digest = fnv1a32(encoder.encode(payload));
    history.push(current_digest);
  }

  return {
    schema: TRANSLATION_POLICY_LAYERED_OBSERVER_SCHEMA,
    depth,
    base_digest: base.digest,
    meta_digest: current_digest,
    meta_digest_hex: `0x${(current_digest >>> 0).toString(16).padStart(8, "0")}`,
    history,
  };
}

export function formatLayeredDigestHud(
  layered: TranslationPolicyLayeredDigest,
): string {
  if (layered.depth === 0) {
    return `[L0 BASE] ${layered.meta_digest_hex}`;
  }
  return `[L${layered.depth} META] ${layered.meta_digest_hex} (<- ... <- ${
    `0x${(layered.base_digest >>> 0).toString(16).padStart(8, "0")}`
  })`;
}
