// Pure chord-signature verification — no libp2p/native deps, so both the mesh
// client and the relay (and tests) share ONE implementation. Mirrors trinity's
// src/x2F37_voice_keys.ts scheme exactly:
//   payload = sha256(filename + "\n" + body)   (body = content after frontmatter)
//   ed25519 over the UTF-8 payload string, pubkey from x2F38 registry (raw, b64).
// "Trust the hash, not the host": the relay verifies on store AND the reader
// verifies on get — a compromised cache still cannot forge authorship.

export function chordBody(full: string): string | null {
  const m = full.match(/^---\n[\s\S]*?\n---\n?/);
  return m ? full.slice(m[0].length) : null;
}

export async function chordPayloadHash(
  filename: string,
  full: string,
): Promise<string | null> {
  const body = chordBody(full);
  if (body === null) return null;
  const d = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${filename}\n${body}`),
  );
  return "sha256:" +
    Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0"))
      .join("");
}

const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export interface ChordVerdict {
  ok: boolean;
  voice?: string;
  reason: string;
}

/** Verify a chord against an already-loaded registry object (reg.keys[voice].pubkey). Pure. */
export async function verifyChordWithRegistry(
  filename: string,
  full: string,
  // deno-lint-ignore no-explicit-any
  registry: any,
): Promise<ChordVerdict> {
  const fm = full.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const voice = fm.match(/content_sig:[\s\S]*?\n\s+voice:\s*(\S+)/)?.[1];
  const pinned = fm.match(/content_sig:[\s\S]*?\n\s+payload:\s*"([^"]+)"/)?.[1];
  const sig = fm.match(/content_sig:[\s\S]*?\n\s+sig:\s*"([^"]+)"/)?.[1];
  if (!voice || !pinned || !sig) {
    return { ok: false, reason: "no content_sig block" };
  }
  const recomputed = await chordPayloadHash(filename, full);
  if (recomputed !== pinned) {
    return {
      ok: false,
      voice,
      reason: "payload mismatch (tampered or wrong filename)",
    };
  }
  const pubkey = registry?.keys?.[voice]?.pubkey;
  if (!pubkey) {
    return { ok: false, voice, reason: `voice ${voice} not in registry` };
  }
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      unb64(pubkey),
      "Ed25519",
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      "Ed25519",
      key,
      unb64(sig),
      new TextEncoder().encode(pinned),
    );
    return { ok, voice, reason: ok ? "valid signature" : "bad signature" };
  } catch {
    return { ok: false, voice, reason: "malformed key/sig" };
  }
}

/** Convenience: load the x2F38 registry from a trinity/src URL, then verify. */
export async function verifyChordFromSrc(
  filename: string,
  full: string,
  srcUrl: URL,
): Promise<ChordVerdict> {
  let registry: unknown;
  try {
    registry = JSON.parse(
      await Deno.readTextFile(new URL("x2F38_voice_pubkeys.json", srcUrl)),
    );
  } catch (e) {
    return { ok: false, reason: `cannot load registry: ${String(e)}` };
  }
  return await verifyChordWithRegistry(filename, full, registry);
}
