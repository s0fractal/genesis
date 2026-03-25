// Ambient Types Header
// These interfaces are globally available to the Deno LSP via deno.json configured "types" array.

interface LatticeConfig {
    sectors: number;
    radialBins: number;
    harmonics: number;
    wrapSectors: boolean;
    hasAntipode: boolean;
}

interface PhaseFieldShape {
    tauDepth: number;
    sectors: number;
    radialBins: number;
    harmonics: number;
}

interface PhaseCell {
    theta: number;
    omega: number;
    amplitude: number;
    lock: number;
    entanglement: number;
    cellStatus?: number;
    plasmids?: bigint;
}

interface PhaseField {
    shape: PhaseFieldShape;
    currentTau: number;
    theta: Uint8Array;
    omega: Int16Array;
    amplitude: Uint8Array;
    lock: Uint8Array;
    entanglement: Uint8Array;
    cellStatus: Uint8Array;
    plasmids: BigUint64Array;
}

interface BridgeField {
    width: number;
    height: number;
    thetaNow: Uint8Array;
    thetaF1: Uint8Array;
    thetaF2: Uint8Array;
    thetaF3: Uint8Array;
    omega: Uint8Array;
    energy: Uint8Array;
    plasmids: BigUint64Array;
    hebbianLocks: Uint8Array;
    oracleRequests: Uint32Array;
    oracleRequestCount: number;
    cellStatus: Uint8Array;
}

type Term = number;

interface SomaticNode {
    ast: Term;
    l1_cost: number;
    depth: number;
    nodes: number;
    attention: number;
    age: number;
    energy: number;
    fitness: number;
    mutualists: Set<bigint>;
    sector: number;
    temporal_credit: number;
    parents?: string[];
    vectorClock?: Record<string, number>;
}

interface SerializedPlasmid {
    hash: string;
    ast: string;
    energy: number;
    attention: number;
    l1_cost: number;
    mutualists: string[];
    age: number;
    fitness: number;
    depth: number;
    nodes: number;
    parents?: string[];
    vectorClock?: Record<string, number>;
}

interface SemanticEvent {
    epoch: number;
    action: string;
    hash?: string;
}

interface GenesisManifest {
    version: number;
    schema: string;
}

interface SubstrateState {
    manifest?: GenesisManifest;
    globalEnergy: number;
    epochTicks: number;
    registry: SerializedPlasmid[];
    grid: Record<number, string>; // Sparse stringified map: idx -> childHash
    header_buffer: Uint8Array; // Raw 256-byte OMGA layout
    event_ledger: SemanticEvent[]; // Historian chronological record
}

interface EpochDump {
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

interface NetworkPhenotype {
    behavior: "Aggressive" | "Symbiotic" | "Parasitic" | "Observer";
    latency: number;
    replication_cost: number;
    network_signature: string;
    target_alignment?: string;
}

interface ForeignPlasmid {
    hash: string;
    targetBucket: number;
    origin: string;
    locks: number;
    energy: number;
    signature: string;
    parents?: string[];
    vectorClock?: Record<string, number>;
    phenotype?: NetworkPhenotype;
}

interface PhylogenyRecord {
    t: number;
    alias: string;
    hash: string;
    parents: string[];
    energy: number;
    stability: number;
}

interface OracleCompatibleField {
    get_oracle_request_count(): number;
    ptr_oracle_requests(): number;
    clear_oracle_requests(): void;
    ptr_plasmids?(): number;
    ptr_cell_status?(): number;
    ptr_theta?(): number;
    ptr_omega?(): number;
    ptr_plasmid_collisions?(): number;
    get_collision_count?(): number;
    clear_collisions?(): void;
    cell_count?(): number;
    width?: number;
    height?: number;
    ptr_header?(): number;
}

interface ReplayReferenceTraceEntry {
    tick: number;
    legacySignature: string;
    structuralSignature: string;
    totalAmplitude: number;
    totalEntanglement: number;
}

interface ReplayWasmTraceEntry {
    tick: number;
    legacySignature: string;
    structuralSignature: string;
    totalAmplitude: number;
    totalEntanglement: number;
    omegaSpan: string;
}

interface PhaseReplayGolden {
    schemaVersion: 1;
    shape: PhaseFieldShape;
    ticks: number;
    referenceTrace: ReplayReferenceTraceEntry[];
    wasmTrace: ReplayWasmTraceEntry[];
    invariants: {
        referenceSeedLegacySignature: string;
        referenceSeedStructuralSignature: string;
        wasmSeedStructuralSignature: string;
        rotatedPhaseStructuralSignature: string;
        rotatedAddressStructuralSignature: string;
    };
}

interface PhaseReplayDataset {
    golden: PhaseReplayGolden;
    snapshots: PhaseField[];
}

interface PhaseReplayDiffSummary {
    changedCells: number;
    totalAmplitudeDelta: number;
    totalLockDelta: number;
    totalEntanglementDelta: number;
    maxPhaseDistance: number;
    parityLocked: boolean;
    referenceStructuralSignature: string;
    wasmStructuralSignature: string;
}

interface OracleWorkerRequest {
    count: number;
    requests: number[];
    triggerReason?: string;
    mycelialContext: string;
    structuralImage: string | null;
    currentSeasonName: string;
    macroSeason: number;
    globalEnergyPool: number;
}

interface OracleWorkerResponse {
    maskName: string;
    intentStr: string;
    targetBucket: number;
}

interface ChronosSnapshot {
    ticks: number;
    entropy: number;
    energy: number;
    queue: number;
}

interface PhaseVector {
    angle: number;
    radius: number;
}

interface IPerturbationInjector {
    inject(x: number, y: number, energy: number, radius: number, phaseShift: number, plasmid: Uint8Array): void;
}



type ReplayCompareMode = "none" | "seed" | "previous";
