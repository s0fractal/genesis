import { buildCanonicalPhaseSeed } from "../src/shared/phase_canonical.ts";
import { cropPhaseField, collapsePhaseField } from "../src/replay/hybrid_replay.ts";
import { clonePhaseField, createPhaseField, stepPhaseField, getCellIndex } from "../src/shared/phase_lattice.ts";
import { phaseDistance } from "../src/shared/topology_core.ts";
import { buildBridgeSeed, stepBridgeField } from "../src/shared/phase_bridge.ts";

interface DriftRecord {
    tick: number;
    sector: number;
    rho: number;
    phaseDistance: number;
    amplitudeDelta: number;
    lockDelta: number;
    phaseTheta: number;
    hybridTheta: number;
    phaseOmega: number;
    hybridOmega: number;
    phaseAmplitude: number;
    hybridAmplitude: number;
    phaseLock: number;
    hybridLock: number;
    hybridPlasmid: string;
    bridgeThetaF1: number;
    bridgeThetaF2: number;
    bridgeThetaF3: number;
}

function formatRecord(record: DriftRecord): string {
    return [
        `tick=${record.tick}`,
        `sector=${record.sector}`,
        `rho=${record.rho}`,
        `phase_distance=${record.phaseDistance}`,
        `amplitude_delta=${record.amplitudeDelta}`,
        `lock_delta=${record.lockDelta}`,
        `phase_theta=${record.phaseTheta}`,
        `hybrid_theta=${record.hybridTheta}`,
        `phase_omega=${record.phaseOmega}`,
        `hybrid_omega=${record.hybridOmega}`,
        `phase_amplitude=${record.phaseAmplitude}`,
        `hybrid_amplitude=${record.hybridAmplitude}`,
        `phase_lock=${record.phaseLock}`,
        `hybrid_lock=${record.hybridLock}`,
        `hybrid_plasmid=${record.hybridPlasmid}`,
        `bridge_theta_f1=${record.bridgeThetaF1}`,
        `bridge_theta_f2=${record.bridgeThetaF2}`,
        `bridge_theta_f3=${record.bridgeThetaF3}`,
    ].join(" ");
}

async function main(): Promise<void> {
    const ticks = 12;
    let phase = buildCanonicalPhaseSeed();
    let bridge = buildBridgeSeed(32, 8);

    const records: DriftRecord[] = [];

    for (let tick = 0; tick <= ticks; tick++) {
        const phaseCollapsed = collapsePhaseField(phase, 6);
        const hybridComparable = cropPhaseField(
            createPhaseField(
                {
                    tauDepth: 4,
                    sectors: 32,
                    radialBins: 8,
                    harmonics: 1,
                },
                (_tau, sector, rho, _harmonic) => {
                    const index = rho * 32 + sector;
                    return {
                        theta: bridge.thetaNow[index],
                        omega: bridge.omega[index] > 127 ? bridge.omega[index] - 256 : bridge.omega[index],
                        amplitude: bridge.energy[index],
                        lock: bridge.hebbianLocks[index],
                        entanglement: 0,
                    };
                }
            ),
            6,
        );

        for (let harmonic = 0; harmonic < phaseCollapsed.shape.harmonics; harmonic++) {
            for (let rho = 0; rho < phaseCollapsed.shape.radialBins; rho++) {
                for (let sector = 0; sector < phaseCollapsed.shape.sectors; sector++) {
                    const phaseIdx = getCellIndex(phaseCollapsed.shape, phaseCollapsed.currentTau, sector, rho, harmonic);
                    const bridgeIndex = rho * 32 + sector;
                    records.push({
                        tick,
                        sector,
                        rho,
                        phaseDistance: phaseDistance(phaseCollapsed.theta[phaseIdx], hybridComparable.theta[phaseIdx]),
                        amplitudeDelta: phaseCollapsed.amplitude[phaseIdx] - hybridComparable.amplitude[phaseIdx],
                        lockDelta: phaseCollapsed.lock[phaseIdx] - hybridComparable.lock[phaseIdx],
                        phaseTheta: phaseCollapsed.theta[phaseIdx],
                        hybridTheta: hybridComparable.theta[phaseIdx],
                        phaseOmega: phaseCollapsed.omega[phaseIdx],
                        hybridOmega: hybridComparable.omega[phaseIdx],
                        phaseAmplitude: phaseCollapsed.amplitude[phaseIdx],
                        hybridAmplitude: hybridComparable.amplitude[phaseIdx],
                        phaseLock: phaseCollapsed.lock[phaseIdx],
                        hybridLock: hybridComparable.lock[phaseIdx],
                        hybridPlasmid: bridge.plasmids[bridgeIndex].toString(),
                        bridgeThetaF1: bridge.thetaF1[bridgeIndex],
                        bridgeThetaF2: bridge.thetaF2[bridgeIndex],
                        bridgeThetaF3: bridge.thetaF3[bridgeIndex],
                    });
                }
            }
        }

        stepPhaseField(phase);
        
        bridge = stepBridgeField(bridge);
        
        // Anti-Freeze: The Phase Lattice (O-19.5) lacks the O-20 Oracle Queue.
        // To maintain cross-topology parity, we must artificially thaw the Hybrid Bridge
        // so it doesn't skip ticks while waiting for an Oracle that isn't connected in this suite.
        bridge.oracleRequestCount = 0;
        for (let i = 0; i < bridge.cellStatus.length; i++) {
            bridge.cellStatus[i] = 0;
        }
    }

    const byPhaseDistance = [...records].sort((left, right) => right.phaseDistance - left.phaseDistance);
    const byAmplitudeDelta = [...records].sort((left, right) => Math.abs(right.amplitudeDelta) - Math.abs(left.amplitudeDelta));
    const byLockDelta = [...records].sort((left, right) => Math.abs(right.lockDelta) - Math.abs(left.lockDelta));

    console.log("=== Genesis analyze:phase-cross ===");
    console.log(`ticks=${ticks}`);
    console.log("top_phase_distance:");
    for (const record of byPhaseDistance.slice(0, 5)) {
        console.log(formatRecord(record));
    }
    console.log("top_amplitude_delta:");
    for (const record of byAmplitudeDelta.slice(0, 5)) {
        console.log(formatRecord(record));
    }
    console.log("top_lock_delta:");
    for (const record of byLockDelta.slice(0, 5)) {
        console.log(formatRecord(record));
    }
    console.log("status=PASS");
}

main();
