import { readFile } from "node:fs/promises";
import initWasm, {
    Field,
    execute_phase_bridge_tick,
    field_omega_span,
    field_signature,
    field_total_energy,
    field_total_locks,
    field_total_plasmids,
    rotate_field_sectors,
    seed_phase_bridge_pattern,
} from "../omega_core/pkg/omega_core.js";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function tick(field: Field, ticks: number): void {
    for (let i = 0; i < ticks; i++) {
        execute_phase_bridge_tick(field, 0);
    }
}

async function main(): Promise<void> {
    const wasmBytes = await readFile(new URL("../omega_core/pkg/omega_core_bg.wasm", import.meta.url));
    await initWasm({ module_or_path: wasmBytes });

    const ticks = 6;

    const left = new Field(32, 8);
    const right = new Field(32, 8);
    seed_phase_bridge_pattern(left);
    seed_phase_bridge_pattern(right);
    tick(left, ticks);
    tick(right, ticks);
    assert(field_signature(left) === field_signature(right), "WASM phase bridge deterministic replay failed");

    const rotated = new Field(32, 8);
    const baseline = new Field(32, 8);
    seed_phase_bridge_pattern(rotated);
    seed_phase_bridge_pattern(baseline);
    rotate_field_sectors(rotated, 5);
    tick(rotated, ticks);
    tick(baseline, ticks);
    rotate_field_sectors(baseline, 5);
    assert(field_signature(rotated) === field_signature(baseline), "WASM phase bridge angular rotation equivariance failed");

    const wrap = new Field(32, 8);
    seed_phase_bridge_pattern(wrap);
    const seedSig = field_signature(wrap);
    rotate_field_sectors(wrap, 32);
    assert(field_signature(wrap) === seedSig, "WASM phase bridge wraparound identity failed");

    console.log("=== Genesis verify:phase-bridge:wasm ===");
    console.log(`ticks=${ticks}`);
    console.log(`signature=${field_signature(left)}`);
    console.log(`total_energy=${field_total_energy(left)}`);
    console.log(`total_locks=${field_total_locks(left)}`);
    console.log(`total_plasmids=${field_total_plasmids(left)}`);
    console.log(`omega_span=${field_omega_span(left)}`);
    console.log("status=PASS");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
