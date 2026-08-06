// The mesh's peer discovery used to be one multiaddr baked into bootstrap/v2.ts.
// These lock the replacement: a configurable list, resolved without throwing on
// any host, where an operator override REPLACES the public default.

import { assertEquals } from "jsr:@std/assert@1";
import {
  DEFAULT_BOOTSTRAP_PEERS,
  parsePeerList,
  resolveBootstrapPeers,
} from "../src/network/bootstrap_peers.ts";

type Injectable = { __OMEGA_BOOTSTRAP_PEERS__?: string | string[] };

function withInjected(value: string | string[] | undefined, fn: () => void) {
  const g = globalThis as Injectable;
  const prev = g.__OMEGA_BOOTSTRAP_PEERS__;
  try {
    if (value === undefined) delete g.__OMEGA_BOOTSTRAP_PEERS__;
    else g.__OMEGA_BOOTSTRAP_PEERS__ = value;
    fn();
  } finally {
    if (prev === undefined) delete g.__OMEGA_BOOTSTRAP_PEERS__;
    else g.__OMEGA_BOOTSTRAP_PEERS__ = prev;
  }
}

Deno.test("parsePeerList splits on commas and newlines, dropping blanks", () => {
  assertEquals(parsePeerList("/a, /b\n/c\r\n\n , ,/d "), [
    "/a",
    "/b",
    "/c",
    "/d",
  ]);
  assertEquals(parsePeerList("   "), []);
});

Deno.test("with no override the built-in default list is used", () => {
  withInjected(undefined, () => {
    assertEquals(resolveBootstrapPeers(), [...DEFAULT_BOOTSTRAP_PEERS]);
  });
});

Deno.test("an operator override REPLACES the public default, never extends it", () => {
  withInjected(["/dns4/relay.mine/tcp/443/wss/p2p/Qmmine"], () => {
    const peers = resolveBootstrapPeers();
    assertEquals(peers, ["/dns4/relay.mine/tcp/443/wss/p2p/Qmmine"]);
    // Sovereignty over discovery means the public node is not quietly re-added.
    assertEquals(peers.includes(DEFAULT_BOOTSTRAP_PEERS[0]), false);
  });
});

Deno.test("a string override is parsed as a list", () => {
  withInjected("/a/one, /b/two", () => {
    assertEquals(resolveBootstrapPeers(), ["/a/one", "/b/two"]);
  });
});

Deno.test("an empty or all-blank override falls through instead of disabling discovery", () => {
  withInjected([], () => {
    assertEquals(resolveBootstrapPeers(), [...DEFAULT_BOOTSTRAP_PEERS]);
  });
  withInjected(["", "   "], () => {
    assertEquals(resolveBootstrapPeers(), [...DEFAULT_BOOTSTRAP_PEERS]);
  });
});

Deno.test("the default list is non-empty and every entry is a multiaddr", () => {
  assertEquals(DEFAULT_BOOTSTRAP_PEERS.length > 0, true);
  for (const addr of DEFAULT_BOOTSTRAP_PEERS) {
    assertEquals(addr.startsWith("/"), true, `${addr} is not a multiaddr`);
    assertEquals(addr.includes("/p2p/"), true, `${addr} has no PeerId`);
  }
});
