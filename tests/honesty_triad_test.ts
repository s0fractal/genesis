import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.224.0/path/mod.ts";

// Executable honesty gate for omega's two non-production headline pieces. The
// third — the ZK prover — is real now (`omega_zk_host` runs a real cpu STARK by
// default; `tests/…/real_proof.rs`). Bitcoin anchoring went LIVE 2026-06-28
// (first mainnet OMEGA1 anchor under a real 3-of-5 quorum; emission isolated to
// the quorum-gated `tools/anchor_emit.ts`, verify-side `bitcoin_anchor.ts` stays
// pure). The mesh is honestly NOT production. THESE GATES LOCK THAT: each
// asserts the CODE state and the README claim AGREE, so neither can silently
// drift into "a mock in a real costume". If you make the mesh signaling real,
// or emission leaks into the verify-side, these red — forcing README + gate to
// move in the same change. No costume.

const OMEGA = dirname(dirname(fromFileUrl(import.meta.url)));
const read = (p: string) => Deno.readTextFileSync(join(OMEGA, p));

Deno.test("honesty: the WebRTC/libp2p mesh is a stub, and the README says so", () => {
  const client = read("src/sdk/phi_client.ts");
  // (a) the stub is honestly marked
  assert(
    client.includes("minimal stub") ||
      client.includes("In a real implementation"),
    "phi_client lost its stub marker — if real signaling shipped, say so in the README; otherwise the honesty was deleted",
  );
  // (b) and the real SDP signaling handshake is genuinely absent
  assert(
    !/\.(createOffer|createAnswer|setLocalDescription|setRemoteDescription)\(/
      .test(client),
    "phi_client now performs real SDP signaling — the mesh may be real; update the README's 'mesh is experimental' claim and this gate",
  );
  // (c) and the README still flags the mesh as experimental
  assert(
    /mesh is experimental|transport is experimental/i.test(read("README.md")),
    "README no longer flags the WebRTC/libp2p mesh as experimental — code (a stub) and docs disagree",
  );
});

Deno.test("honesty: anchoring is LIVE, emission isolated to the quorum-gated tool", () => {
  // Anchoring went live 2026-06-28 (first mainnet OMEGA1 anchor, tx 262ac275…,
  // under a real 3-of-5 quorum). The invariant now is the BOUNDARY: emission
  // lives ONLY in the quorum-gated tool, never in the verify-side module.
  const anchor = read("src/network/bitcoin_anchor.ts");
  // (a) bitcoin_anchor.ts stays verify-only — broadcast must NOT leak into it.
  assert(
    !/sendrawtransaction|broadcastTransaction|submitTransaction|pushTx/i
      .test(anchor),
    "bitcoin_anchor.ts gained a broadcast path — emission must stay in tools/anchor_emit.ts (verify-side stays pure)",
  );
  // (b) the emitter is real and carries the quorum gate (no costume).
  const emit = read("tools/anchor_emit.ts");
  assert(
    /verifyAnchorQuorum/.test(emit) && /"broadcast"/.test(emit),
    "anchor_emit.ts lost its quorum-gated emission path — anchoring claims live but isn't",
  );
  // (c) the README states anchoring is LIVE (not the stale 'not live').
  assert(
    /Bitcoin anchoring is LIVE/i.test(read("README.md")),
    "README no longer says anchoring is LIVE — code (live emission) and docs disagree",
  );
});
