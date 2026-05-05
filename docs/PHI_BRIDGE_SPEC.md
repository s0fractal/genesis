# Φ-Bridge Specification

The Φ-Bridge is the minimal, typed, unidirectional conduit linking the **Liquid** (Ontological/Agentic Substrate) with **OMEGA** (Physical/Consensus Substrate).

OMEGA does not parse the internal semantic state of Liquid, nor does Liquid directly drive the mechanical actuation of OMEGA. All interactions cross through this formalized membrane.

## Philosophy

- **OMEGA** computes what can physically happen.
- **Liquid** decides what it means.

## Message Types

### 1. Liquid Intent → OMEGA Plasmid

Liquid projects intent to the physical layer. OMEGA receives this as an `INTENT` plasmid containing only actionable physical attributes.

#### Liquid Side (Semantic Origin)
```typescript
type LiquidIntent = {
  intent: string;              // The raw semantic objective
  agentId?: string;            // The identity of the semantic neuron
  declaredValues?: string[];   // Associated moral values
  rho: number;                 // Metabolic attention (energy)
  phaseVector: number[];       // 8D phase orientation
};
```

#### OMEGA Side (Physical Representation)
```typescript
type OmegaPlasmidIntent = {
  semanticType: "INTENT";
  attractorAddress: number;    // Hash representing the intent's gravitational pull
  matrix: number;              // Verification matrix
  inverse: number;             // Verification inverse dipole
  pulseAmp: number;            // Mapped from Liquid rho
  pulseFreq: number;           // Mapped from Liquid phaseVector
  recursionDepth: number;      // Mesh routing parameters
  maxRecursion: number;
};
```

**Directionality**: Liquid emits. OMEGA receives and physically propagates across the P2P mesh.

### 2. OMEGA Receipt → Liquid Causal Event

OMEGA notifies Liquid of the physical consensus outcome. Liquid archives this as a historical Causal Event.

#### OMEGA Side (Physical Result)
```typescript
type OmegaReceipt = {
  status: "ACCEPTED" | "REJECTED" | "PROOF_FAILED" | "MUTATION_APPLIED" | "BOUNDARY_BLOCKED";
  hash: string;                // Cryptographic proof identifier
  energyCost: number;          // ATP consumed
  tau: number;                 // Bitcoin block height anchor
};
```

#### Liquid Side (Semantic Integration)
```typescript
type LiquidCausalEvent = {
  eventType: "PHYSICS_RECEIPT";
  receiptData: OmegaReceipt;
  interpretation: string;      // How this receipt aligns with current intent
  distressTriggered: boolean;  // Did this rejection cause structural pain?
};
```

**Directionality**: OMEGA emits. Liquid interprets and absorbs into its autobiography.
