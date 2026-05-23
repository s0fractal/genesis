# OMEGA-64 | Era 206: Localized Causality & Asynchronous Time

_Codename: The End of the Global God-Clock_

## 1. Abstract

Since Genesis, OMEGA-64 has operated like a standard video game or cellular
automaton: `requestAnimationFrame` triggers a global `tick()`. Every plasmid
gets evaluated exactly once per cycle. Entropy is computed as a global average.

This model enforces a "God's Eye View" causality. Era 206 shatters this. By
introducing **Local Entropy** and **Asynchronous Clocks**, OMEGA-64 stops being
a simulation and becomes a relativistic ecosystem. Time moves faster in chaotic
zones and freezes in crystallized mathematical dead zones.

## 2. Breaking the Global Thermostat (Geographical Entropy)

The 4096 spatial buckets of the Phase Lattice are now divided into **64
Ecological Sectors** (Regions of $8 \times 8$ buckets).

Instead of one `globalEntropy` driving the Oracle's mutation rate, we compute
`sectorHeat[64]`.

- A sector heats up when plasmids inside it mutate rapidly or execute high-cost
  L1 math.
- A sector cools down when plasmids stall or stabilize into identity loops
  ($I$).
- This allows **Ecological Niches** to form: A boiling rainforest of rapid
  mutation can exist directly adjacent to a frozen glacier of perfectly stable,
  untouchable pure logic.

## 3. Asynchronous Time (Relativistic Plasmids)

The `SUPERSCHEDULER` is refactored from a global priority queue into a local
temporal loop.

### 3.1 Time Credits

Every somatic node receives a `temporal_credit` parameter. During a physical
tick, we distribute time unevenly:
$$ \text{Credits Added} = \text{Base Rate} + (\text{Sector Heat} \times \text{Relativity Multiplier}) $$

### 3.2 Time Expansion & Dilation

- **Hot Zones (Fast Time)**: A plasmid in a chaotic sector might receive `3.5`
  credits per frame. The `SUPERSCHEDULER` will execute its mathematical AST 3
  times instantly, running its evolution at 300% speed relative to the rest of
  the matrix.
- **Cold Zones (Time Dilation)**: A plasmid in a crystallized sector might
  receive `0.05` credits per frame. It will take 20 frames to accumulate enough
  time to execute even once. Its evolution functionally freezes.

### 3.3 The Consequence

Global causality is dead. `requestAnimationFrame` is merely the physics engine
rendering the substrate. The actual _biology_ evaluates at entirely different
asynchronous speeds depending on its own local topology. The system is no longer
a clock; it is a fluid.

## 4. Implementation Vectors

1. **Sector Mapping**: `oracle.ts` must maintain a `Float32Array(64)` of
   `sectorHeat`.
2. **Heat Accumulation**: Executing PoUW successfully or doing HGT injects heat
   into the plasmid's local sector.
3. **Temporal Sub-Loop**: `evaluateFitness` is called inside a
   `while (node.temporal_credit >= 1.0)` loop, allowing rapid ultra-ticks for
   hot plasmids.
4. **Heat Dissipation**: Sector heat slowly decays towards absolute zero over
   time, requiring active logic to maintain localized warmth.
