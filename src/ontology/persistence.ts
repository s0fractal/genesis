import { encode, decode } from "@msgpack/msgpack";
import { formatTerm, SomaticNode } from "../compiler/pure_lambda.ts";

export function exportGenesisState(
    epochTicks: number,
    globalEnergy: number,
    plasmidsArray: BigUint64Array,
    size: number,
    headerBuffer: Uint8Array,
    eventLedger: SemanticEvent[],
    registry: Map<bigint, SomaticNode>
): Uint8Array {
    const population = Array.from(registry.entries()).map(([hash, node]) => ({
        hash: hash.toString(),
        ast: formatTerm(node.ast),
        energy: node.energy === Infinity ? -1 : node.energy, // msgpack/json inf handling
        attention: node.attention,
        l1_cost: node.l1_cost,
        age: node.age,
        fitness: node.fitness,
        depth: node.depth,
        nodes: node.nodes,
        mutualists: Array.from(node.mutualists).map(h => h.toString())
    }));

    const sparseGrid: Record<number, string> = {};
    for (let i = 0; i < size; i++) {
        const hash = plasmidsArray[i];
        if (hash !== 0n) {
            sparseGrid[i] = hash.toString();
        }
    }

    const payload: SubstrateState = {
        manifest: { version: 4200, schema: "omega-64-stratum" },
        globalEnergy,
        epochTicks,
        registry: population,
        grid: sparseGrid,
        header_buffer: headerBuffer,
        event_ledger: eventLedger
    };

    return encode(payload);
}

export function parseGenesisState(buffer: ArrayBuffer): SubstrateState {
    const decoded = decode(new Uint8Array(buffer)) as SubstrateState;
    if (!decoded.manifest || decoded.manifest.version < 4200) {
        console.warn(`[AION] Genesis Version Mismatch. Found: ${decoded.manifest?.version || 'Legacy'}, Expected: 4200+. Proceeding loosely with downward migration...`);
        // Future migration logic placeholder: return migrateFromEra63(decoded);
    }
    return decoded;
}

// Browser specific download hook (no Deno / FS required)
export function downloadGenesisFile(buffer: Uint8Array, currentEpoch: number) {
    const blob = new Blob([buffer.buffer as ArrayBuffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omega_64_${currentEpoch}_${Date.now()}.genesis`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
}
