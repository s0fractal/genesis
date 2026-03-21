import { readFile } from "node:fs/promises";
import initWasm, { PhaseLatticeField, get_phase_lut_ptr } from "../omega_core/pkg/omega_core.js";

async function main() {
    const wasmBytes = await readFile(new URL("../omega_core/pkg/omega_core_bg.wasm", import.meta.url));
    const wasm = await initWasm({ module_or_path: wasmBytes });
    console.log("Memory buffer byteLength:", wasm.memory.buffer.byteLength);
    
    const field = new PhaseLatticeField(32, 6, 3);
    console.log("current_tau:", field.current_tau, field.current_tau === undefined ? "[UNDEFINED]" : "[OK]");
    console.log("cell_count:", field.cell_count());
    console.log("tau_depth:", field.tau_depth);
    
    console.log("ptr_theta:", field.ptr_theta());
    console.log("ptr_omega:", field.ptr_omega());
    
    const memory = wasm.memory as WebAssembly.Memory;
    const omega = new Int16Array(memory.buffer, field.ptr_omega(), 10);
    console.log("First 10 omega values:", Array.from(omega));
}
main();
