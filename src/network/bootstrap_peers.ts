// Bootstrap peer discovery configuration.
//
// The mesh used to carry exactly one hardcoded multiaddr in bootstrap/v2.ts.
// Dialing it already failed soft (a warn, not a throw), so the failure mode was
// not a crash — it was worse: a silent, unannounced loss of peer discovery in a
// layer whose own comment reads "No centralized relay!". One address baked into
// a build is a centralized relay; it just has no owner willing to say so.
//
// Resolution order, most explicit first:
//   1. `globalThis.__OMEGA_BOOTSTRAP_PEERS__` — string or string[], injected by
//      the page alongside `__OMEGA_GENESIS_TXID__`.
//   2. `OMEGA_BOOTSTRAP_PEERS` env var (Deno / CLI hosts), comma-separated.
//   3. `localStorage["omega.bootstrapPeers"]`, comma- or newline-separated —
//      an operator can repoint a running deployment without a rebuild.
//   4. `DEFAULT_BOOTSTRAP_PEERS`.
//
// Any of 1–3 REPLACES the default list rather than extending it: an operator
// who names their own bootstrappers is asserting sovereignty over discovery,
// and silently re-adding a public node behind their back would defeat that.

/**
 * Built-in fallback. Deliberately a list even though it currently holds one
 * entry: the public libp2p bootstrapper, which is the only address in this
 * repository verified to actually answer.
 *
 * Additional peer IDs are NOT invented here — a mistyped PeerId produces a
 * dial that can never succeed while looking like redundancy, which is a worse
 * failure than an honest single entry. Run your own relay and inject it, or
 * append IDs you have confirmed against a live node.
 */
export const DEFAULT_BOOTSTRAP_PEERS: readonly string[] = [
  "/dns4/bootstrap.libp2p.io/tcp/443/wss/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
];

/** Split a comma/newline/whitespace-separated list, dropping empties. */
export function parsePeerList(raw: string): string[] {
  return raw
    .split(/[,\n\r]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Resolve the bootstrap multiaddr list for this host. Never throws: a host
 * without env permission or without DOM storage falls through to the default.
 */
export function resolveBootstrapPeers(): string[] {
  const injected = (globalThis as {
    __OMEGA_BOOTSTRAP_PEERS__?: string | string[];
  }).__OMEGA_BOOTSTRAP_PEERS__;
  if (Array.isArray(injected)) {
    const list = injected.filter((s) =>
      typeof s === "string" && s.trim().length > 0
    ).map((s) => s.trim());
    if (list.length > 0) return list;
  } else if (typeof injected === "string" && injected.trim()) {
    return parsePeerList(injected);
  }

  try {
    // @ts-ignore: Deno is only available in backend/CLI contexts
    const fromEnv = typeof Deno !== "undefined"
      // @ts-ignore
      ? Deno.env.get("OMEGA_BOOTSTRAP_PEERS")
      : undefined;
    if (fromEnv && fromEnv.trim()) return parsePeerList(fromEnv);
  } catch {
    // env permission not granted — fall through, not an error
  }

  try {
    const stored = globalThis.localStorage?.getItem("omega.bootstrapPeers");
    if (stored && stored.trim()) return parsePeerList(stored);
  } catch {
    // no DOM storage in this host — fall through
  }

  return [...DEFAULT_BOOTSTRAP_PEERS];
}
