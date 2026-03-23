// Ambient Types Header
// These interfaces are globally available to the Deno LSP via deno.json configured "types" array.

interface LatticeConfig {
    sectors: number;
    radial_bins: number;
    harmonics: number;
}

interface PhaseFieldShape {
    tauDepth: number;
    sectors: number;
    radialBins: number;
    harmonics: number;
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
}

interface SemanticEvent {
    epoch: number;
    action: string;
    hash?: string;
}

interface SubstrateState {
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

interface ForeignPlasmid {
    hash: string;
    targetBucket: number;
    origin: string;
    locks: number;
    energy: number;
    signature: string;
}

interface PhylogenyRecord {
    id: string; // Unique combination of hash and timestamp, or just hash if immortal
    hash: string;
    ast: string;
    birth_epoch: number;
    death_epoch: number | null;
    peak_energy: number;
    peak_attention: number;
    generations_survived: number;
    parents: string[]; 
    children: string[]; 
}

interface OracleCompatibleField {
    get_oracle_request_count(): number;
    ptr_oracle_requests(): number;
    clear_oracle_requests(): void;
    ptr_plasmids(): number;
    ptr_cell_status(): number;
    ptr_theta?(): number;
    ptr_omega?(): number;
    ptr_plasmid_collisions?(): number;
    get_collision_count?(): number;
    clear_collisions?(): void;
    cell_count?(): number;
    width?: number;
    height?: number;
}
