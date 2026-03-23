import { exportGenesisState, parseGenesisState } from "./src/ontology/persistence.ts";
import { SemanticEvent, SubstrateState } from "./src/env.d.ts";
import { PlasmidRegistry, parseLambda } from "./src/compiler/pure_lambda.ts";

const dummyHeader = new Uint8Array(256);
dummyHeader[0] = 79; // 'O'
dummyHeader[1] = 77; // 'M'
dummyHeader[2] = 71; // 'G'
dummyHeader[3] = 65; // 'A'
dummyHeader[8] = 100; // Sectors = 100

PlasmidRegistry.set(12345n, {
    ast: parseLambda("S(K(I))"),
    l1_cost: 10,
    depth: 3,
    nodes: 5,
    attention: 100,
    age: 50,
    energy: 5000,
    fitness: 1.5,
    mutualists: new Set([54321n])
});

const dummyPlasmids = new BigUint64Array(10);
dummyPlasmids[5] = 12345n;

const dummyLedger: any[] = [
    { epoch: 10, action: "SENATE_INJECT", hash: "12345" }
];

console.log("Encoding Genesis State...");
const binary = exportGenesisState(
    42, // epochTicks
    10000, // globalEnergy
    dummyPlasmids,
    10, // size
    dummyHeader,
    dummyLedger 
);

console.log(`Successfully encoded ${binary.length} bytes.`);

console.log("Decoding Genesis State...");
const exactBuffer = new ArrayBuffer(binary.byteLength);
new Uint8Array(exactBuffer).set(binary);

const payload = parseGenesisState(exactBuffer);

console.log("Decoded Epoch Ticks:", payload.epochTicks);
console.log("Decoded Global Energy:", payload.globalEnergy);
console.log("Decoded Grid[5]:", payload.grid[5]);
console.log("Decoded Header Magic:", String.fromCharCode(payload.header_buffer[0], payload.header_buffer[1], payload.header_buffer[2], payload.header_buffer[3]));
console.log("Decoded Header Sectors:", new DataView(payload.header_buffer.buffer, payload.header_buffer.byteOffset, payload.header_buffer.byteLength).getUint32(8, true));
console.log("Decoded Event Ledger:", payload.event_ledger);

if (payload.header_buffer.length === 256 && payload.event_ledger.length === 1 && payload.event_ledger[0].action === "SENATE_INJECT") {
    console.log("✅ STRUCTURAL SERIALIZATION TEST PASSED.");
} else {
    console.error("❌ STRUCTURAL SERIALIZATION TEST FAILED.");
}
