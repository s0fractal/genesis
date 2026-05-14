/**
 * 960: Environmental Resonance Layer
 *
 * Hardware-Constrained Q-Topology Generation.
 * This module measures the host device's physical capabilities (VRAM/RAM limits)
 * and applies Cyber-Darwinism constraints to derive pure Power-of-Two dimensions.
 */

export interface HardwareLimits {
    maxStorageBuffer: number;
    maxComputeInvocations: number;
}

export interface QTopology {
    q_sectors: number;     // e.g. 7 (2^7 = 128 sectors)
    q_radial: number;      // e.g. 6 (2^6 = 64 rings)
    q_harmonics: number;   // e.g. 3 (2^3 = 8 resonance harmonics)
    q_tau: number;         // strictly 3 (8 depth footprint)

    agentSize: number;     // 16 (Minimal) or 32 (Smart)
    maxAllocatedAgents: number; // The Darwinian cap
}

/**
 * Calculates the exact topological dimensions ensuring the WebGPU VRAM
 * buffer is fully saturated but never overflows.
 *
 * @param adapter The initialized WebGPU Adapter
 * @param agentSize Either 16 (Minimal) or 32 (Smart) bytes, exact SIMD alignment required
 */
export async function measureHardwareEnvironment(adapter: GPUAdapter, agentSize: number = 16): Promise<QTopology> {
    // 1. Establish Absolute Hardware Ceilings
    const maxVRAM = adapter.limits.maxStorageBufferBindingSize || 134_217_728; // Fallback 128 MB on old devices

    // 2. Apply Darwinian 80% Envelope Limit
    const budgetBytes = Math.floor(maxVRAM * 0.8);
    const maxAgents = Math.floor(budgetBytes / agentSize);

    // 3. Mathematical Foundations
    const q_tau = 3; // Tau historical footprint is strictly 8 (ZK-Proof window)
    const tau_depth = 1 << q_tau;

    // Starts at a guaranteed safe bottom-limit (64x32x4)
    let q_sectors = 6;
    let q_radial = 5;
    let q_harmonics = 2;

    // 4. Upward Q-Power Gradient Search
    while (true) {
        let currentAgents = (1 << q_sectors) * (1 << q_radial) * (1 << q_harmonics) * tau_depth;

        // Priority 1: Expand Sectors to maximum 128 (q=7) as dictated by the 128-Sector sweet spot
        if (q_sectors < 7 && currentAgents * 2 <= maxAgents) {
            q_sectors++;
            continue;
        }

        // Priority 2: Expand Radial depth up to 128 (q=7)
        if (q_radial < 7 && currentAgents * 2 <= maxAgents) {
            q_radial++;
            continue;
        }

        // Priority 3: Expand Harmonic complexity up to 16 (q=4)
        if (q_harmonics < 4 && currentAgents * 2 <= maxAgents) {
            q_harmonics++;
            continue;
        }

        // Priority 4: If VRAM is immense (e.g. M3 Max), expand radial up to 256
        if (q_radial < 8 && currentAgents * 2 <= maxAgents) {
            q_radial++;
            continue;
        }

        break;
    }

    const calculatedAgents = (1 << q_sectors) * (1 << q_radial) * (1 << q_harmonics) * tau_depth;

    console.log(`[OMEGA-64] Cyber-Climate Established:`);
    console.log(` - VRAM Target: ${(budgetBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(` - Agent Form: ${agentSize} Bytes (${agentSize === 16 ? 'Minimal' : 'Smart'})`);
    console.log(` - Matrix Dimensions: Sectors: ${1 << q_sectors}, Radial: ${1 << q_radial}, Harmonics: ${1 << q_harmonics}`);
    console.log(` - Total Agents Allocated: ${calculatedAgents.toLocaleString()} / ${maxAgents.toLocaleString()}`);

    return {
        q_sectors,
        q_radial,
        q_harmonics,
        q_tau,
        agentSize,
        maxAllocatedAgents: calculatedAgents
    };
}

/**
 * Bitcoin UTXO Weather Controller
 * Connects the Digital Organism's metabolism to the physical reality of the Bitcoin blockchain.
 */
import { fetchAnchorBalance } from "../network/bitcoin_anchor.ts";

export class BitcoinWeatherController {
    private anchorAddress: string;
    private checkIntervalMs: number;
    private lastTxCount: number = -1;
    private intervalId: number | null = null;

    // Q10 representation of 1.0 = 1024
    public currentMetabolicMultiplier: number = 1024;
    public currentLabel: string = "☀️ 1.0x (Calm)";

    public onWeatherChange: ((multiplier: number, label: string) => void) | null = null;

    constructor(anchorAddress: string = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", checkIntervalMs: number = 600000) {
        this.anchorAddress = anchorAddress;
        this.checkIntervalMs = checkIntervalMs;
    }

    public start() {
        if (this.intervalId !== null) return;
        this.checkWeather();
        // @ts-ignore
        this.intervalId = setInterval(() => this.checkWeather(), this.checkIntervalMs);
    }

    public stop() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    public async checkWeather() {
        const stats = await fetchAnchorBalance(this.anchorAddress);
        if (!stats) return;

        let multiplier = 1024; // 1.0x baseline
        let label = "☀️ 1.0x (Calm)";

        // 1. Transaction Velocity = Metabolic Heat
        if (this.lastTxCount !== -1) {
            const txDelta = stats.txCount - this.lastTxCount;
            if (txDelta > 0) {
                // Network is active -> Higher metabolism (faster decay)
                multiplier = 1024 + (txDelta * 100); // 1.0x + 0.1x per TX
                label = `🌩️ ${(multiplier / 1024).toFixed(2)}x (Active)`;
            }
        }
        this.lastTxCount = stats.txCount;

        // 2. High Balance = Evolutionary Stress / Abundance
        // If balance > 1 BTC (100M sats), it's a massive weather event
        if (stats.balanceSats > 100_000_000) {
            multiplier += 512; // +0.5x
            label = `🌋 ${(multiplier / 1024).toFixed(2)}x (Heavy)`;
        } else if (stats.balanceSats === 0) {
            multiplier = Math.max(512, multiplier - 256); // -0.25x (Calm, dormant)
            if (multiplier < 1024) label = `❄️ ${(multiplier / 1024).toFixed(2)}x (Dormant)`;
        }

        // Clamp between 0.5x and 4.0x
        this.currentMetabolicMultiplier = Math.min(4096, Math.max(512, multiplier));

        if (this.onWeatherChange) {
            this.onWeatherChange(this.currentMetabolicMultiplier, label);
        }

        console.log(`[WEATHER] Anchor ${this.anchorAddress} | Sats: ${stats.balanceSats} | TXs: ${stats.txCount} | Weather: ${label}`);
    }
}
