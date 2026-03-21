import { readFile } from "node:fs/promises";
import initWasm, {
    Field,
    execute_phase_bridge_tick,
    field_signature,
    seed_phase_bridge_pattern,
} from "../omega_core/pkg/omega_core.js";
import {
    snapshotBridgeWasmState,
} from "./phase_golden_common.ts";
import {
    bridgeFieldSignature,
    bridgeOmegaSpan,
    bridgeTotalEnergy,
    bridgeTotalLocks,
    bridgeTotalPlasmids,
    buildBridgeSeed,
    stepBridgeField,
} from "../src/shared/phase_bridge.ts";
import type { BridgeField } from "../src/shared/phase_bridge.ts";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function compareTick(reference: BridgeField, actual: BridgeField, tick: number): void {
    assert(reference.width === actual.width, `bridge width mismatch at tick=${tick}`);
    assert(reference.height === actual.height, `bridge height mismatch at tick=${tick}`);

    const size = reference.width * reference.height;
    for (let index = 0; index < size; index++) {
        const sector = index % reference.width;
        const rho = Math.trunc(index / reference.width);
        compareValue("thetaNow", reference.thetaNow[index], actual.thetaNow[index], tick, sector, rho);
        compareValue("thetaF1", reference.thetaF1[index], actual.thetaF1[index], tick, sector, rho);
        compareValue("thetaF2", reference.thetaF2[index], actual.thetaF2[index], tick, sector, rho);
        compareValue("thetaF3", reference.thetaF3[index], actual.thetaF3[index], tick, sector, rho);
        compareValue("omegaRaw", reference.omega[index], actual.omega[index], tick, sector, rho);
        compareValue("energy", reference.energy[index], actual.energy[index], tick, sector, rho);
        compareValue("lock", reference.hebbianLocks[index], actual.hebbianLocks[index], tick, sector, rho);
        compareValue("plasmid", reference.plasmids[index], actual.plasmids[index], tick, sector, rho);
        compareValue("status", reference.cellStatus[index], actual.cellStatus[index], tick, sector, rho);
    }

    assert(
        reference.oracleRequestCount === actual.oracleRequestCount,
        `bridge oracleRequestCount mismatch at tick=${tick}: reference=${reference.oracleRequestCount} actual=${actual.oracleRequestCount}`,
    );

    for (let index = 0; index < reference.oracleRequestCount; index++) {
        compareValue(
            "oracleRequest",
            reference.oracleRequests[index],
            actual.oracleRequests[index],
            tick,
            index,
            0,
        );
    }
}

function compareValue(
    label: string,
    reference: number | bigint,
    actual: number | bigint,
    tick: number,
    sector: number,
    rho: number,
): void {
    if (reference !== actual) {
        throw new Error(
            `${label} mismatch at tick=${tick} sector=${sector} rho=${rho}: reference=${String(reference)} actual=${String(actual)}`,
        );
    }
}

async function main(): Promise<void> {
    const wasmBytes = await readFile(new URL("../omega_core/pkg/omega_core_bg.wasm", import.meta.url));
    const wasm = await initWasm({ module_or_path: wasmBytes });

    const width = 32;
    const height = 8;
    const ticks = 24;

    const size = width * height;
    let reference = buildBridgeSeed(width, height);
    const field = new Field(width, height);
    
    // O-64: Guarantee strict float parity between JS (V8) and Rust (LLVM)
    // The native atan2 trig derivations can drift by 1 ULP off perfect 0.5 boundaries.
    // Sync TS state verbatim into WASM Field before any Tick Execution runs!
    const wasmMem = new Uint8Array(wasm.memory.buffer);
    wasmMem.set(reference.thetaNow, field.ptr_theta_now());
    wasmMem.set(reference.thetaF1, field.ptr_theta_f1());
    wasmMem.set(reference.thetaF2, field.ptr_theta_f2());
    wasmMem.set(reference.thetaF3, field.ptr_theta_f3());
    wasmMem.set(reference.omega, field.ptr_omega());
    wasmMem.set(reference.energy, field.ptr_energy());
    wasmMem.set(reference.hebbianLocks, field.ptr_hebbian_locks());
    wasmMem.set(reference.cellStatus, field.ptr_cell_status());
    
    // Plasmids uses BigUint64 arrays, explicitly shift pointers
    const wasmMem64 = new BigUint64Array(wasm.memory.buffer, field.ptr_plasmids(), size);
    wasmMem64.set(reference.plasmids);
    
    // Initialize oracle requests pointer mapping
    const wasmMem32 = new Uint32Array(wasm.memory.buffer, field.ptr_oracle_requests(), 1024);
    wasmMem32.set(reference.oracleRequests);
    field.oracle_request_count = reference.oracleRequestCount;

    for (let tick = 0; tick <= ticks; tick++) {
        const wasmState = snapshotBridgeWasmState(field, wasm);
        compareTick(reference, wasmState, tick);

        const referenceSignature = bridgeFieldSignature(reference);
        const wasmSignature = field_signature(field);
        assert(
            referenceSignature === wasmSignature,
            `bridge signature mismatch at tick=${tick}: reference=${referenceSignature} wasm=${wasmSignature}`,
        );

        if (tick < ticks) {
            reference = stepBridgeField(reference);
            execute_phase_bridge_tick(field, 0);
        }
    }

    console.log("=== Genesis verify:phase-bridge:parity ===");
    console.log(`shape=${width} sectors x ${height} rings`);
    console.log(`ticks=${ticks}`);
    console.log(`signature=${bridgeFieldSignature(reference)}`);
    console.log(`total_energy=${bridgeTotalEnergy(reference)}`);
    console.log(`total_locks=${bridgeTotalLocks(reference)}`);
    console.log(`total_plasmids=${bridgeTotalPlasmids(reference)}`);
    console.log(`omega_span=${bridgeOmegaSpan(reference)}`);
    console.log("status=PASS");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
