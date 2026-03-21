import { decode } from "@msgpack/msgpack";
import type { EpochDump } from "./epoch_dumper.ts";

export async function analyzeEpochDumps(oldFile: string, newFile: string): Promise<string> {
    try {
        const oldRaw = await Deno.readFile(oldFile);
        const newRaw = await Deno.readFile(newFile);
        
        const oldDump = decode(oldRaw) as EpochDump;
        const newDump = decode(newRaw) as EpochDump;
        
        const ticks = newDump.epochTicks - oldDump.epochTicks;
        const activeTime = newDump.timestamp - oldDump.timestamp;
        
        const energyDelta = newDump.globalEnergy - oldDump.globalEnergy;
        const popDelta = newDump.populationCount - oldDump.populationCount;
        const entropyDelta = newDump.physics.entropy - oldDump.physics.entropy;
        
        let report = `[EPOCH TRANSCRIPT] Analyzing ${ticks} ticks over ${(activeTime/1000).toFixed(1)}s.\n`;
        report += `Macro Trends:\n`;
        report += `- Global Energy Pool: ${newDump.globalEnergy.toFixed(0)} (${energyDelta > 0 ? '+' : ''}${energyDelta.toFixed(0)})\n`;
        report += `- Unique Logic Genomes (Population): ${newDump.populationCount} (${popDelta > 0 ? '+' : ''}${popDelta})\n`;
        report += `- Torus Thermodynamics (Entropy): ${newDump.physics.entropy.toFixed(2)} (${entropyDelta > 0 ? '+' : ''}${entropyDelta.toFixed(2)})\n\n`;
        
        report += `Apex Substrate Tracking:\n`;
        
        // Track survivability of the top 3 dominating organisms from the old dump
        for (let i = 0; i < Math.min(3, oldDump.dominantPlasmids.length); i++) {
            const ancestor = oldDump.dominantPlasmids[i];
            const descendant = newDump.dominantPlasmids.find(p => p.hash === ancestor.hash);
            
            report += `> Lineage [${ancestor.hash.substring(0,8)}] AST: ${ancestor.ast}\n`;
            if (descendant) {
                const attDelta = descendant.attention - ancestor.attention;
                const enDelta = descendant.energy - ancestor.energy;
                report += `  Status: SURVIVED. Attention ${attDelta > 0 ? '+' : ''}${attDelta}, Energy ${enDelta > 0 ? '+' : ''}${enDelta.toFixed(0)}.\n`;
            } else {
                report += `  Status: EXTINCT. Failed to survive Somatic Economy.\n`;
            }
        }
        
        // Identify new apex predators
        report += `\nNew Dominant Emergence:\n`;
        for (let i = 0; i < Math.min(3, newDump.dominantPlasmids.length); i++) {
            const predator = newDump.dominantPlasmids[i];
            const wasInTopOld = oldDump.dominantPlasmids.find(p => p.hash === predator.hash);
            if (!wasInTopOld) {
                report += `> [${predator.hash.substring(0,8)}] AST: ${predator.ast} (L1: ${predator.l1_cost})\n`;
                report += `  Secured Apex ranking with ${predator.attention} Attention.\n`;
            }
        }
        
        return report;
    } catch (e) {
        console.error(`[WATCHDOG] ❌ Failed to analyze epoch dumps:`, e);
        return `[EPOCH TRANSCRIPT ERROR] Failed to load trajectories. Rely on biological intuition.`;
    }
}
