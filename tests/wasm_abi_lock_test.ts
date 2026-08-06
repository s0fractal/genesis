// Cross-language lock on the WASM ABI.
//
// `WebAssembly.Instance.exports` is typed `Record<string, ExportValue>`, so
// `exports.v2_anything` type-checks — including a name the kernel does not
// export. `deno check` cannot help, and the cast that follows
// (`as CallableFunction`) removes the last hint that anything is unverified.
// The failure lands on a user, at runtime, as `undefined is not a function`.
//
// It already had. `v2_bridge.ts` called `exports.v2_ingest_cosmic_entropy`,
// while `omega_v2` exported `ingest_cosmic_entropy` — an INHERENT METHOD
// carrying `#[no_mangle] extern "C"`, so its symbol took `&mut self` as
// argument 0 and no JS caller could have used it safely even with the right
// name. Every EVM block threw into a `catch` that logged and continued, so the
// cosmic-entropy path was dead in a way that looked like weather.
//
// This test reads the Rust source, extracts the symbols actually exported as
// FREE functions, and asserts that every export the TypeScript reaches for is
// one of them. It runs in the unit suite: no toolchain, no build, no wasm.

import { assertEquals } from "jsr:@std/assert@1";

const RUST_DIRS = ["../omega_v2/src"];
const TS_DIRS = ["../src"];

/** Symbols the kernel exports and JS may legally call. */
function rustFreeExports(): Map<string, number> {
  const out = new Map<string, number>();
  for (const dir of RUST_DIRS) {
    const base = new URL(dir + "/", import.meta.url);
    for (const entry of Deno.readDirSync(base)) {
      if (!entry.isFile || !entry.name.endsWith(".rs")) continue;
      const src = Deno.readTextFileSync(new URL(entry.name, base));
      const re =
        /#\[no_mangle\]\s*(?:#\[[^\]]*\]\s*)*pub (?:unsafe )?extern "C" fn ([a-z0-9_]+)\s*\(([^)]*)\)/g;
      for (const m of src.matchAll(re)) {
        const params = m[2].trim();
        // A receiver makes the symbol uncallable from JS: argument 0 would have
        // to be a valid Rust pointer. Such an export is a bug, not an API.
        if (/^&?\s*(mut\s+)?self\b/.test(params)) continue;
        const arity = params === ""
          ? 0
          : params.split(",").filter((p) => p.trim()).length;
        out.set(m[1], arity);
      }
    }
  }
  return out;
}

/** Symbols reached for as `…exports.NAME` anywhere in the TS host. */
function tsReferencedExports(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const walk = (dir: URL) => {
    for (const entry of Deno.readDirSync(dir)) {
      const child = new URL(
        entry.name + (entry.isDirectory ? "/" : ""),
        dir,
      );
      if (entry.isDirectory) {
        walk(child);
      } else if (entry.name.endsWith(".ts")) {
        const src = Deno.readTextFileSync(child);
        for (const m of src.matchAll(/exports\s*\.\s*([a-z0-9_]+)/g)) {
          const name = m[1];
          if (name === "memory") continue; // WebAssembly.Memory, not a function
          const list = out.get(name) ?? [];
          list.push(entry.name);
          out.set(name, list);
        }
      }
    }
  };
  for (const dir of TS_DIRS) walk(new URL(dir + "/", import.meta.url));
  return out;
}

const rust = rustFreeExports();
const ts = tsReferencedExports();

Deno.test("every WASM export the host calls exists as a free Rust export", () => {
  const unresolved: string[] = [];
  for (const [name, files] of ts) {
    if (!rust.has(name)) {
      unresolved.push(`${name} (called from ${[...new Set(files)].join(", ")})`);
    }
  }
  // If this fails, the host is calling into a symbol the kernel does not
  // export — a runtime TypeError waiting for whoever hits that code path.
  // Either the Rust name changed, or the export is an inherent method and
  // needs a free `v2_*` wrapper (see v2_ingest_cosmic_entropy in lib.rs).
  assertEquals(unresolved, [], "host calls WASM symbols the kernel lacks");
});

Deno.test("REGRESSION: no exported symbol takes a self receiver", () => {
  // `#[no_mangle] pub extern "C" fn foo(&mut self, ...)` compiles, exports, and
  // is unusable: argument 0 must be a real Rust pointer. It reads as an API and
  // is a trap. Scan for the pattern directly rather than trusting that the
  // extractor above skipped it.
  const offenders: string[] = [];
  const base = new URL("../omega_v2/src/", import.meta.url);
  for (const entry of Deno.readDirSync(base)) {
    if (!entry.isFile || !entry.name.endsWith(".rs")) continue;
    const src = Deno.readTextFileSync(new URL(entry.name, base));
    const re =
      /#\[no_mangle\]\s*(?:#\[[^\]]*\]\s*)*pub (?:unsafe )?extern "C" fn ([a-z0-9_]+)\s*\(\s*&?\s*(?:mut\s+)?self\b/g;
    for (const m of src.matchAll(re)) {
      offenders.push(`${entry.name}: ${m[1]}`);
    }
  }
  assertEquals(offenders, [], "extern \"C\" exports that take a receiver");
});

Deno.test("v2_ingest_cosmic_entropy is a callable free export", () => {
  // The specific casualty, pinned: one u64 argument, no receiver.
  assertEquals(rust.get("v2_ingest_cosmic_entropy"), 1);
  assertEquals(rust.has("ingest_cosmic_entropy"), false);
});

Deno.test("the SHIPPED binary exports every symbol the host calls", () => {
  // The checks above compare Rust SOURCE against TS. They cannot see the third
  // party in this contract: `public/v2/omega_v2_core.wasm` is a committed
  // artifact with a pinned sha256, built by whoever last ran `npm run
  // build:wasm`. Source agreement plus a stale binary is still a runtime
  // TypeError — so read the binary's own symbol table.
  //
  // If this fails after a kernel change, the fix is `npm run build:wasm` and
  // updating `omega_v2_core.wasm.sha256`. It is deliberately NOT ignored:
  // the app really is broken between the source change and the rebuild, and a
  // test that stays green through that would be telling a comfortable lie.
  const wasm = Deno.readFileSync(
    new URL("../public/v2/omega_v2_core.wasm", import.meta.url),
  );
  const haystack = new TextDecoder("latin1").decode(wasm);
  const absent: string[] = [];
  for (const [name] of ts) {
    // Only assert symbols the kernel source actually exports; a name the source
    // lacks is already reported by the first test, and reporting it twice
    // obscures which of the two problems is present.
    if (!rust.has(name)) continue;
    if (!haystack.includes(name)) absent.push(name);
  }
  assertEquals(absent, [], "shipped wasm predates the kernel source");
});

Deno.test("the lock is actually looking at something", () => {
  // Guards against a regex that silently matches nothing, which would make
  // every assertion above vacuously true.
  assertEquals(rust.size > 50, true, `only found ${rust.size} Rust exports`);
  assertEquals(ts.size > 20, true, `only found ${ts.size} TS references`);
});
