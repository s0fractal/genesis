import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.224.0/path/mod.ts";

// Executable honesty gate for omega's two non-production headline pieces. The
// third — the ZK prover — is real now (`omega_zk_host` runs a real cpu STARK by
// default; `tests/…/real_proof.rs`). The mesh and Bitcoin anchoring are honestly
// NOT production, and THESE GATES LOCK THAT: each asserts that the CODE state and
// the README claim AGREE, so neither can silently drift into "a mock in a real
// costume". If you make the mesh signaling or Bitcoin emission real, these red —
// forcing you to update the README and this gate in the same change. No costume.

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

Deno.test("honesty: Bitcoin anchoring is verify-only, and the README says so", () => {
  const anchor = read("src/network/bitcoin_anchor.ts");
  // (a) verify-only: no transaction-broadcast path exists
  assert(
    !/sendrawtransaction|broadcastTransaction|submitTransaction|pushTx/i
      .test(anchor),
    "bitcoin_anchor gained a transaction-broadcast path — if on-chain emission is now live, update the README and this gate",
  );
  // (b) and the README still flags anchoring as not-live
  assert(
    /Bitcoin anchoring is not live/i.test(read("README.md")),
    "README no longer flags Bitcoin anchoring as not-live — code (verify-only) and docs disagree",
  );
});
