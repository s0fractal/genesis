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
    preferredTheta?: number;
    memoryStrength?: number;
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
    preferredTheta: Uint8Array;
    memoryStrength: Uint8Array;
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
    last_known_idx?: number; // Era 233.2: Tracking physical memory locus for migration
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

// Era 247: Event Sourcing & Structural Sharing
interface PlasmidMutationRecord {
    hash: string;
    parentHashes: string[];
    sector: number;
    ast: string;
}

interface GenesisDelta {
    parentHash: string;
    tickRange: [number, number];
    mutations: {
        plasmidBirths: PlasmidMutationRecord[];
        plasmidDeaths: string[];
        energyTransfers: { from: string; to: string; amount: number }[];
    };
    thermodynamicSnapshot: {
        entropy: number; // Q10 scalar
        totalEnergy: number; // Joules
        kuramotoR: number; // Coupling coherence
    };
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
    ptr_active_genomes?(): number;
    evaluate_genome_resonance?(idx: number): number;
    ptr_plasmid_collisions?(): number;
    get_collision_count?(): number;
    clear_collisions?(): void;
    ptr_spatial_memory_theta?(): number;
    ptr_spatial_memory_strength?(): number;
    cell_count?(): number;
    width?: number;
    height?: number;
    ptr_header?(): number;
    swap_agents?(idx_a: number, idx_b: number): void;
    check_memory_canary?(): boolean;
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
    prophecy?: string;
    physicsGenome?: PhysicsGenome;
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




// Era 255: Evolutionary Sandbox Physics (ESP)
interface PhysicsGenome {
    id: string;
    couplingK: number; // Q10 Format (1024 = 1.0)
    mutationRate: number; // Q10 Format
    diffusionRate: number; // Q10 Format
    scopeRadius: number; // Topos distance
    ttl: number; // Phase lattice ticks to live
    cost: number; // Thermodynamic ATP cost
    stabilityScore?: number; // Phase Selection Pressure (PSP) resonance
    createdAt?: number; // Injection timestamp
}

type ReplayCompareMode = "none" | "seed" | "previous";
