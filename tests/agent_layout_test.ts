// The instruments read the right fields — checked against a real world.
//
// This is the test the measurement stack did not have. Every number in
// `docs/PHYSICS.md` is read out of wasm memory by hand-written word offsets, and
// until now nothing verified that those offsets point where they are believed
// to point. `omega_v2/tests/ffi_layout.rs` pins the Rust side and goes red if a
// field moves — loudly, in the right repo. The TypeScript side would keep
// reading the old positions, silently, and a shifted field does not produce an
// error. It produces a plausible number, in a document that says "measured".
//
// Two ways to check it, and only one of them is worth anything:
//
//   COMPARING CONSTANTS. Parse the offsets out of ffi_layout.rs and assert the
//   table here matches. Cheap, and it verifies that two lists agree — not that
//   either describes the struct the kernel actually writes.
//
//   ASKING THE WORLD. Ignite a real lattice, run it, and assert each field
//   satisfies a property that ONLY that field can satisfy. Energy is bounded by
//   MAX_ATP; phase is bounded by the wrap; the dead flag is clear for everything
//   the kernel counts as living; a genome is unbounded and spread. Read the
//   genome where energy lives and the bound fails immediately.
//
// Both are here. The second is the one that would catch a layout change that
// somebody helpfully updated in both lists.

import { assert, assertEquals } from "jsr:@std/assert";
import {
  AGENT_WORDS,
  AgentView,
  FIELD,
  FLAG_DEAD,
} from "../src/shared/agent_layout.ts";
import { MAX_ATP } from "../src/shared/generated_constants.ts";

const PHASE_SPAN = 256; // q_phase = 8 since Era 966

async function ignitedWorld(agents = 1024, ticks = 300) {
  const bytes = await Deno.readFile("./public/v2/omega_v2_core.wasm");
  const { instance } = await WebAssembly.instantiate(bytes, { env: {} });
  const x = instance.exports as Record<string, CallableFunction>;
  const memory = instance.exports.memory as WebAssembly.Memory;
  x.v2_boot_engine();
  x.v2_set_environment(7, 6, 2, 1024);
  x.v2_ignite_big_bang(0x0EC0_0107, agents);
  for (let t = 1; t <= ticks; t++) {
    x.v2_tick();
    if (t % 10 === 0) x.v2_mitosis_sweep();
  }
  const active =
    new Uint32Array(memory.buffer, (x.v2_lattice_ptr() as number) + 32, 12)[4];
  const a = new Uint32Array(
    memory.buffer,
    x.v2_agents_ptr() as number,
    active * AGENT_WORDS,
  );
  return { view: new AgentView(a), active, raw: a };
}

Deno.test("each field is where the instruments think it is", async () => {
  const { view, active } = await ignitedWorld();
  assert(active > 64, `fixture produced only ${active} agents`);

  let living = 0;
  let distinctGenomes = new Set<number>();
  for (let i = 0; i < active; i++) {
    if (!view.alive(i)) continue;
    living++;

    // ENERGY. Clamped to MAX_ATP everywhere it is written; nothing else in the
    // struct is. A genome read here would exceed it on the first agent.
    const e = view.energy(i);
    assert(
      e > 0 && e <= MAX_ATP,
      `energy at word ${FIELD.energy} reads ${e}, outside 1..${MAX_ATP} — the ` +
        `instruments are reading a different field than they believe`,
    );

    // PHASE. Masked with max_phase on every write, so it cannot leave the wrap.
    const p = view.phase(i);
    assert(
      p < PHASE_SPAN,
      `phase at word ${FIELD.phase} reads ${p}, outside 0..${PHASE_SPAN - 1}`,
    );

    // STATE FLAGS. The kernel's own liveness predicate already filtered on bit
    // 0, so this is a tautology *unless* the field moved — in which case
    // `alive()` was reading something else and this is the only thing that
    // notices.
    assertEquals(view.stateFlags(i) & FLAG_DEAD, 0);

    distinctGenomes.add(view.genome(i));
  }

  assert(living > 32, `only ${living} living agents; nothing to check`);

  // GENOME. Drawn from a 32-bit PRNG and mutated on every birth, so it is the
  // one field with no bound and a wide spread. Energy or phase read here would
  // collapse to a handful of values.
  assert(
    distinctGenomes.size > living / 4,
    `genome at word ${FIELD.genome} has only ${distinctGenomes.size} distinct ` +
      `values across ${living} agents — that is the spread of a bounded field, ` +
      `not of a genome`,
  );
});

Deno.test("the layout table still matches the Rust side", async () => {
  // The cheap half: the two lists agree. Kept because a mismatch here is a
  // faster and clearer signal than a bounds failure, not because it proves
  // anything the test above does not.
  const rust = await Deno.readTextFile(
    new URL("../omega_v2/tests/ffi_layout.rs", import.meta.url),
  );
  const byteOffset = (field: string) => {
    const m = rust.match(
      new RegExp(`offset_of!\\(PhaseAgentMinimal, ${field}\\), (\\d+)`),
    );
    assert(m, `ffi_layout.rs no longer pins the offset of ${field}`);
    return Number(m![1]);
  };
  for (
    const [ts, rs] of [
      ["phase", "phase"],
      ["energy", "energy"],
      ["baseFreq", "base_freq"],
      ["stateFlags", "state_flags"],
      ["genome", "genome"],
      ["memory0", "memory"],
    ] as const
  ) {
    assertEquals(
      FIELD[ts] * 4,
      byteOffset(rs),
      `${ts} is at word ${FIELD[ts]} here and byte ${byteOffset(rs)} in Rust`,
    );
  }
  assert(
    /size_of::<PhaseAgentMinimal>\(\), 32/.test(rust),
    "the agent is no longer 32 bytes; AGENT_WORDS is wrong",
  );
  assertEquals(AGENT_WORDS, 8);
});
