import { encode } from "@msgpack/msgpack";
import { formatTerm, PlasmidRegistry } from "../compiler/pure_lambda.ts";

export interface SerializedPlasmid {
    hash: string;
    ast: string;
    energy: number;
    attention: number;
    l1_cost: number;
    mutualists: string[];
}

export interface EpochDump {
    timestamp: number;
    epochTicks: number;
    globalEnergy: number;
    populationCount: number;
    physics: {
        entropy: number;
        omegaSpan: string;
        amplitude: number;
    };
    dominantPlasmids: SerializedPlasmid[];
}

export async function flushEpochBinary(
    epochTicks: number,
    globalEnergy: number,
    entropy: number,
    omegaSpan: string,
    amplitude: number
): Promise<string> {
    const timestamp = Date.now();
    
    if (typeof globalThis.Deno === "undefined") {
        console.warn(`[WATCHDOG] 🚫 Browser environment detected. Skipping Epoch filesystem dump.`);
        return `browser_mock_${timestamp}.bin`;
    }

    // @ts-ignore: Deno is dynamically available in Native mode
    await Deno.mkdir("./mycelium/dumps", { recursive: true });
    
    // Extract top 100 dominant plasmids by attention/energy to prevent massive dumps
    const population = Array.from(PlasmidRegistry.entries())
        .map(([hash, node]) => ({ hash, node }))
        .sort((a, b) => b.node.attention - a.node.attention);
        
    const dominantNodes = population.slice(0, 100).map(({ hash, node }) => ({
        hash: hash.toString(),
        ast: formatTerm(node.ast),
        energy: node.energy === Infinity ? -1 : node.energy, // -1 means Infinity for JSON/MsgPack compat
        attention: node.attention,
        l1_cost: node.l1_cost,
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
