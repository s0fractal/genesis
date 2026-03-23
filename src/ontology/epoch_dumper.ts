import { encode } from "@msgpack/msgpack";
import { formatTerm, SomaticNode } from "../compiler/pure_lambda.ts";

export async function flushEpochBinary(
    epochTicks: number,
    globalEnergy: number,
    entropy: number,
    omegaSpan: string,
    amplitude: number,
    registry: Map<bigint, SomaticNode>
): Promise<string> {
    const timestamp = Date.now();
    
    if (typeof globalThis.Deno === "undefined") {
        console.warn(`[WATCHDOG] 🚫 Browser environment detected. Skipping Epoch filesystem dump.`);
        return `browser_mock_${timestamp}.bin`;
    }

    // @ts-ignore: Deno is dynamically available in Native mode
    await Deno.mkdir("./mycelium/dumps", { recursive: true });
    
    // Extract top 100 dominant plasmids by attention/energy to prevent massive dumps
    const population = Array.from(registry.entries())
        .map(([hash, node]) => ({ hash, node }))
        .sort((a, b) => b.node.attention - a.node.attention);
        
    const dominantNodes = population.slice(0, 100).map(({ hash, node }) => ({
        hash: hash.toString(),
        ast: formatTerm(node.ast),
        energy: node.energy === Infinity ? -1 : node.energy, // -1 means Infinity for JSON/MsgPack compat
        attention: node.attention,
        l1_cost: node.l1_cost,
        age: node.age || 0,
        fitness: node.fitness || 0,
        depth: node.depth || 1,
        nodes: node.nodes || 1,
        mutualists: Array.from(node.mutualists).map(h => h.toString())
    }));

    const dump: EpochDump = {
        timestamp,
        epochTicks,
        globalEnergy,
        populationCount: population.length,
        physics: {
            entropy,
            omegaSpan,
            amplitude
        },
        dominantPlasmids: dominantNodes,
    };

    const binary = encode(dump);
    const filename = `./mycelium/dumps/epoch_${timestamp}.bin`;
    // @ts-ignore
    await Deno.writeFile(filename, binary);
    
    console.log(`[WATCHDOG] 📦 Wrote Epoch Dump (${binary.byteLength} bytes) to ${filename}`);
    return filename;
}

export async function archiveLedgerChunk(events: SemanticEvent[]): Promise<string> {
    const timestamp = Date.now();
    
    if (typeof globalThis.Deno === "undefined") {
        console.warn(`[WATCHDOG] 🚫 Browser environment detected. Skipping Ledger chunk dump.`);
        return `browser_mock_ledger_${timestamp}.msgpack`;
    }

    // @ts-ignore: Deno is dynamically available natively
    await Deno.mkdir("./mycelium/ledgers", { recursive: true });
    
    const binary = encode(events);
    const filename = `./mycelium/ledgers/ledger_chunk_${timestamp}.msgpack`;
    // @ts-ignore: Deno is dynamically available natively
    await Deno.writeFile(filename, binary);
    
    console.log(`[WATCHDOG] 📚 Archived Ledger Chunk (${events.length} events, ${binary.byteLength} bytes) to ${filename}`);
    return filename;
}
