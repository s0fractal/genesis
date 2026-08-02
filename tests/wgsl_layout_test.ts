// WGSL ↔ TS layout contract — the WebGPU validation guard.
//
// This test exists because of a real incident (2026-08-01): the renderer
// allocated `signalsBuffer` as 32 bytes while both WGSL shaders declare
// `SignalStore` as 48 bytes, bound a non-existent `binding(4)` into the
// compute pass, and bound agents where `render_v2.wgsl` expects the signals
// uniform. Every unit test stayed green because none of them touched a GPU;
// the failure would only appear as a WebGPU validation error in a live
// browser. `cargo` side has ffi_layout.rs for the Rust ABI — this file is
// the same idea for the WGSL↔TS seam: parse both sides and fail LOUDLY on
// drift instead of discovering it in devtools.
//
// If you change a WGSL struct, a binding, or a buffer size, this test is
// supposed to break. Update it only together with the shader AND the
// renderer, as one deliberate act.
import { assertEquals } from "jsr:@std/assert";

const SHADER_DIR = new URL("../src/lens/shaders/", import.meta.url);
const MODES_URL = new URL("../src/lens/renderer_modes.ts", import.meta.url);
const BUFFERS_URL = new URL("../src/lens/renderer_buffers.ts", import.meta.url);

function stripComments(src: string): string {
  return src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Parse `struct Name { field: Type, ... }` blocks (also tolerates `};`). */
function parseStructs(src: string): Map<string, [string, string][]> {
  const out = new Map<string, [string, string][]>();
  const re = /struct\s+(\w+)\s*\{([^}]*)\}\s*;?/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const fields: [string, string][] = [];
    const fre = /(\w+)\s*:\s*(array<\w+,\s*\d+>|\w+)\s*,/g;
    let f;
    while ((f = fre.exec(m[2])) !== null) {
      fields.push([f[1], f[2].replace(/\s+/g, "")]);
    }
    out.set(m[1], fields);
  }
  return out;
}

/** Byte size of a WGSL struct (4-byte scalars, nested structs, fixed arrays). */
function structSize(
  name: string,
  structs: Map<string, [string, string][]>,
): number {
  const fields = structs.get(name);
  if (!fields) throw new Error(`struct ${name} not found`);
  let total = 0;
  for (const [, type] of fields) {
    const arr = type.match(/^array<(\w+),(\d+)>$/);
    if (arr) {
      const inner = ["u32", "i32", "f32"].includes(arr[1])
        ? 4
        : structSize(arr[1], structs);
      total += inner * parseInt(arr[2], 10);
    } else if (["u32", "i32", "f32"].includes(type)) {
      total += 4;
    } else {
      total += structSize(type, structs);
    }
  }
  return total;
}

/** `@group(0) @binding(N) var<...> name: Type;` → [binding, type] pairs. */
function parseBindings(src: string): [number, string][] {
  const out: [number, string][] = [];
  const re =
    /@group\(0\)\s*@binding\((\d+)\)\s*var(?:<[^>]*>)?\s+\w+\s*:\s*(\w+)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    out.push([parseInt(m[1], 10), m[2]]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

/** Extract `binding: N` numbers from one `createBindGroup` block. */
function bindGroupEntries(modesSrc: string, varName: string): number[] {
  const re = new RegExp(
    `${varName}\\s*=\\s*this\\.device\\.createBindGroup\\(\\{([\\s\\S]*?)\\}\\);`,
  );
  const m = modesSrc.match(re);
  assertEquals(m !== null, true, `${varName} bind group not found`);
  return [...m![1].matchAll(/binding:\s*(\d+)/g)].map((x) => parseInt(x[1], 10))
    .sort((a, b) => a - b);
}

/** Extract numeric `size:` from `this.<field> = this.device.createBuffer(...)`. */
function bufferSize(buffersSrc: string, field: string): number {
  const re = new RegExp(
    `this\\.${field}\\s*=\\s*this\\.device\\.createBuffer\\(\\{\\s*size:\\s*(\\d+)`,
  );
  const m = buffersSrc.match(re);
  assertEquals(m !== null, true, `${field} createBuffer not found`);
  return parseInt(m![1], 10);
}

Deno.test("WGSL struct sizes match the Rust FFI contract (ffi_layout.rs)", async () => {
  const toroidal = stripComments(
    await Deno.readTextFile(new URL("compute_toroidal.wgsl", SHADER_DIR)),
  );
  const render = stripComments(
    await Deno.readTextFile(new URL("render_v2.wgsl", SHADER_DIR)),
  );

  for (
    const [label, src] of [["toroidal", toroidal], ["render", render]] as const
  ) {
    const structs = parseStructs(src);
    assertEquals(
      structSize("SignalStore", structs),
      48,
      `${label} SignalStore`,
    );
    assertEquals(
      structSize("PhaseTopology", structs),
      32,
      `${label} PhaseTopology`,
    );
    assertEquals(
      structSize("PhaseAgentMinimal", structs),
      32,
      `${label} PhaseAgentMinimal`,
    );
  }

  const tStructs = parseStructs(toroidal);
  assertEquals(structSize("AttractorMatrix", tStructs), 16);
  assertEquals(
    structSize("AttractorArray", tStructs),
    80,
    "count + pad + 4×16",
  );
});

Deno.test("compute_toroidal.wgsl bindings mirror renderer_modes.ts bind groups", async () => {
  const shader = stripComments(
    await Deno.readTextFile(new URL("compute_toroidal.wgsl", SHADER_DIR)),
  );
  const modes = await Deno.readTextFile(MODES_URL);

  const shaderBindings = parseBindings(shader).map(([b]) => b);
  assertEquals(shaderBindings, [0, 1, 2, 3, 7, 8]);

  for (
    const group of ["computeBindGroupToroidalA", "computeBindGroupToroidalB"]
  ) {
    assertEquals(
      bindGroupEntries(modes, group),
      shaderBindings,
      `${group} must bind exactly what the shader declares (layout: 'auto')`,
    );
  }
});

Deno.test("render_v2.wgsl bindings mirror renderer_modes.ts render bind groups", async () => {
  const shader = stripComments(
    await Deno.readTextFile(new URL("render_v2.wgsl", SHADER_DIR)),
  );
  const modes = await Deno.readTextFile(MODES_URL);

  const shaderBindings = parseBindings(shader).map(([b]) => b);
  assertEquals(shaderBindings, [0, 1, 2]);

  for (const group of ["renderBindGroupA", "renderBindGroupB"]) {
    assertEquals(
      bindGroupEntries(modes, group),
      shaderBindings,
      `${group} must bind exactly what the shader declares (layout: 'auto')`,
    );
  }
});

Deno.test("renderer_buffers.ts uniform buffer sizes match WGSL struct sizes", async () => {
  const buffers = await Deno.readTextFile(BUFFERS_URL);
  const toroidal = stripComments(
    await Deno.readTextFile(new URL("compute_toroidal.wgsl", SHADER_DIR)),
  );
  const structs = parseStructs(toroidal);

  assertEquals(
    bufferSize(buffers, "topologyBuffer"),
    structSize("PhaseTopology", structs),
  );
  assertEquals(
    bufferSize(buffers, "signalsBuffer"),
    structSize("SignalStore", structs),
  );
  assertEquals(
    bufferSize(buffers, "attractorBuffer"),
    structSize("AttractorArray", structs),
  );
  // sine_lut: array<i32, 256> storage = 1024 bytes.
  assertEquals(bufferSize(buffers, "sineLutBuffer"), 256 * 4);
});
