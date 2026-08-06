# Era 2070: Physics Boundary Table

To protect the OMEGA-64 organism from "mythological bloat" and ensure strict
separation of concerns, the system is divided into four absolute layers.

## Boundary Definitions

### Layer A — Consensus Physics

- **Permissions:** CAN mutate agent state and consensus structures.
- **Constraints:**
  - Must be integer-only (no floating-point math).
  - Must have an exact golden trace match across all substrates.
  - Must be ZK-verifiable or receipt-verifiable.

### Layer B — Environmental Modulation

- **Permissions:** CAN change tick rate, biological budgets, and weather
  multipliers.
- **Constraints:**
  - Cannot directly create or destroy semantic laws.
  - Must emit telemetry to the Diagnostic Organ (`HomeostasisPolicy`).

### Layer C — Lens / Visualization

- **Permissions:** CAN transform perception and render representations of the
  lattice.
- **Constraints:**
  - Cannot affect the consensus state under any circumstances.
  - Exists purely as a read-only mirror of the physics core.

### Layer D — Philosophy / Narrative

- **Permissions:** CAN propose changes to the Senate (`PROPOSAL`).
- **Constraints:**
  - Cannot mutate physics directly.
  - Operates purely in the semantic and social layers of the mesh.

---

## Era 961 — the law moved, and so did its hash

Seven changes to the physical operator landed on 2026-08-06 (below). All of them
ran under an unchanged `CANONICAL_LAW_HASH = 0x30A95260`, because that preimage
covered five constants and the topology — and not one of the laws that actually
changed.

That is the failure the law hash exists to prevent, in the law hash itself. It
is the federation's cross-substrate agreement anchor: trinity's Substrate Court
compares it, so a node running the closed Era-960 world and a node running this
one would have been declared **in agreement** while computing different
universes.

Two fixes, because one is not enough:

1. **The preimage widened** to the nine constants Era-961 physics is written in
   terms of, and `ERA_ID` moved 960 → 961. `CANONICAL_LAW_HASH` is now
   `0xA43F38A1`, mirrored in `src/shared/law_hash.ts`.
2. **A behavioural anchor** (`omega_v2/tests/behavioral_law_anchor.rs`) runs the
   physics on a fixed fixture and hashes the result. A constant list can never
   see a change in the SHAPE of an equation; this changes if and only if
   behaviour changes. Demonstrated: reverting only the conduction equation, with
   every constant untouched, leaves the declared hash green and turns the
   behavioural anchor red.

The declared hash stays the federation's anchor — it is pure, cheap, and a
stranger can compare it without executing anything, which is the whole point.
The behavioural anchor is what forces it to be bumped honestly.

**Any node still reporting `0x30A95260` is running the world that goes extinct
at tick 86.** It must not be read as agreeing with this one.

## Conservation laws (Layer A)

**The rule: every joule that leaves an agent lands somewhere nameable** — in
another agent, in the metabolic burn, or in `total_entropy_released`. ATP that
merely disappears is a defect, and ATP that appears without a source is a worse
one.

This section records the laws chosen to satisfy that rule, and — equally
important — the places where it does not hold yet. An audit on `45e85ca` found
that the only energy check in the tree was
`total_system_energy <= MAX_ATP * alive_count`, which cannot fail: every
increase site clamps to `MAX_ATP`, every decrease saturates, and both sums are
accumulated over the same predicate in the same pass. That is an identity
wearing the costume of an invariant, and it hid every leak below.

### Death — Landauer's principle, priced in bits

`PhaseLattice::death_entropy`. An agent's state is its genome plus three memory
words: 128 bits. Dissolving it releases `set_bits × LANDAUER_BIT_COST`.

Bits, not magnitudes. This kernel already prices information in bits twice —
metabolic maintenance charges `genome.count_ones()`, mitosis charges
`(parent.genome ^ child.genome).count_ones()` — and death was the one site that
summed the words as numbers, releasing up to ~1.7e10 into a universe where an
agent holds at most `MAX_ATP = 4096`. That is not a large number; it is a
different unit, and it made the documented future where compost feeds ambient
ATP an unbounded faucet rather than a cycle.

### Reproduction — closed

`parent_out == child_in + entropy`. The parent pays `MITOSIS_COST`; the child
receives `CHILD_ENERGY_SEED` minus a Landauer charge per flipped genome bit; the
two constants are equal, so the difference is exactly the erasure and is booked
to the entropy trace.

Two things had to change for this to hold. The erasure tax was deleted rather
than released. And the parent was debited _before_ the sweep looked for a vacant
slot, so on a full lattice it paid 1024 ATP for a child that was never born —
for every fertile agent, every sweep, meaning a saturated lattice bled in
proportion to its own fertility.

### Predation — a share bounded by the prey's per-neighbour capacity

`PhaseLattice::predation_share`, mirrored bit-for-bit in
`compute_toroidal.wgsl`:

```text
share(prey_energy) = min(PREDATOR_ENERGY_STEAL, prey_energy / 8)
```

The 8 is the Moore neighbourhood — the length of `n_indices` and the bound of
the shader's neighbour loop. At most eight predators, each taking at most
`prey_energy / 8`, remove at most `prey_energy`. Conservative by construction,
and proved exhaustively over `0..=MAX_ATP` rather than argued.

Both roles price the transfer off the **prey's** pre-tick energy, so the two
halves of one meal agree without communicating — the predator reads it from the
neighbour's snapshot, the prey from its own not-yet-written value.

Above `PREDATOR_ENERGY_STEAL * 8 = 40` ATP the prey's capacity clears the flat
rate and the share is exactly the old constant, so a healthy ecosystem behaves
precisely as it did before. Only the starving regime changes — which is the
regime the flat rate broke: a prey holding 3 ATP could lose only 3, while eight
predators each credited themselves 5.

### Dissipation — recovered at the substrate boundary

`PhaseLattice::reap_off_cpu_deaths`. Between two sweeps, ATP that left the live
population without arriving anywhere else is booked to the trace. Transfers
between agents are internal and cancel; only what the step actually spent
remains.

This is how metabolic burn, and the `MAX_ATP` clamp's discarded surplus, reach
the ledger at all. The shader cannot record them — `signals` is `var<uniform>`
there — so they are recovered from the one thing a substrate cannot hide: the
difference between the state it was handed and the state it returned. Burn alone
is several ATP per agent per tick and dwarfs both death (≤128) and the mitosis
erasure tax (≤32), so a trace carrying only those two was reporting a rounding
error and calling it thermodynamics.

**A rise is never booked.** Energy appearing from nowhere is a defect, not
negative entropy, and absorbing it here would make this ledger the same
tautology as the old energy audit — always consistent, never informative.
Conservation is asserted by test instead.

Ordering matters and is load-bearing: `darwinian_mitosis` runs after the reaper
and re-arms the snapshot at its end, so reproduction's own erasure tax — which
it books itself — is not re-read as unexplained loss on the following sweep.

### Photosynthesis — the world is open, and the income is counted

`SOLAR_YIELD_Q10 × sun_multiplier / 2²⁰` ATP to every living agent, every tick,
mirrored bit-for-bit in `compute_toroidal.wgsl`. Zero at midnight, double at
noon. Calibrated by measurement rather than taste: at `SOLAR_YIELD_Q10 = 18432`
the fittest agents reach the 2048 reproduction threshold and the rest do not,
which is what makes an environment selective rather than merely survivable.
Below it nobody approaches maturity; well above it every agent clears the bar at
once and efficiency stops mattering. The homeostat pushes back —
`metabolic_pressure` scales burn with the population's own average wealth — so
yield and equilibrium are not proportional.

**A closed world cannot host life.** That is the second law, not a bug, and it
was measured before it was fixed: 1024 agents, extinct at tick 86, zero births
ever, because predation and diffusion are zero-sum, burn is a sink, and total
energy therefore only falls — so no agent can ever climb to `MITOSIS_THRESHOLD`.
Not rarely. Never.

`sun_multiplier` already existed and only multiplied **burn**: the sun made
agents hungrier at noon and fed nobody, while the comment beside it in the
shader claimed "energy is strictly zero-sum except for solar input" — naming a
source that was not there. This law is that comment coming true.

Income is a **named counter** (`SignalStore.total_solar_input`, occupying what
was declared padding), not a silent term, for the same reason a rise is never
booked as entropy: a source that is not counted is indistinguishable from a leak
running backwards. The dissipation identity carries it —
`dissipated = (held + solar) − held_after` — because without the income term
only the NET drop would be booked, and the ledger would go quiet on exactly the
ticks when the ecosystem was thriving.

Measured after: population stable at 1024 across 6000 ticks, books closing to
the joule (`start + solar == end + spent`, leaked 0). The world stopped dying —
and then revealed the next two failures, both recorded below.

### Conduction — gated by phase coherence

`((neighbour − self) / 8) × max(0, cos_q10(neighbour.phase, self.phase)) / 1024`

Ungated, conduction was by far the strongest transfer in the model: it moved up
to the full energy gradient every tick, while predation moves at most
`PREDATOR_ENERGY_STEAL`. The food web therefore existed and decided nothing —
levelling outran advantage, and the population homogenised into a crystal in
which the richest agent sat at ~600 against a reproduction threshold of 2048,
forever.

These are Kuramoto oscillators, so sharing now follows the thing this system
actually models: neighbours in phase pool their energy, neighbours out of phase
do not. Coherent clusters equalise internally while staying distinct from one
another, which is what makes accumulation — and therefore selection — possible.
Measured effect: the population's energy spread widened from ~40 ATP to ~350.

Conservative. `cos_q10` is symmetric across the whole LUT (verified exhaustively
over all 65,536 pairs) and truncating division is odd-symmetric, so the pairwise
transfer stays antisymmetric and no ATP is created.

### The day is a storage cycle, not a scaling factor

`sun_multiplier` used to scale metabolic burn as well as income. Once
photosynthesis was lit, that made both sides of the ledger double at noon and
halve at midnight — the day cancelled itself out, and there was no window in
which an organism could store a surplus, which is what a day is for.

Burn now depends only on `metabolic_pressure`. The mean is unchanged (one Q10
factor left the numerator and the divisor together), but burn is flat across the
day while income follows the sky, so agents charge by day and spend by night.

### Growth — the Big Bang does not fill the universe

`ignite_big_bang(seed, capacity)` seeds `BIG_BANG_SEED_DENSITY_Q10 / 1024` of
the lattice with life and leaves the rest empty; `max_cells` records the
capacity the host allocated. When a fertile parent finds no vacancy among the
living, `darwinian_mitosis` appends a child at the frontier and grows
`active_agent_count`, stopping at `max_cells`.

Before this, the argument was both capacity and living count, so every slot was
occupied at t=0. Mitosis places a child in a vacancy, and a vacancy only appears
when something dies — so reproduction was gated on mortality, and a world with a
sun strong enough to keep everyone alive was **sterile by construction**. Not a
tuning problem: measured at `SOLAR_YIELD_Q10 = 18432`, 1024 alive at tick 1500,
the richest agent past the fertility threshold, zero deaths and therefore zero
births.

Empty Center, taken literally: the world begins with room.

Measured after — capacity 4096, seeded 1024, over 5000 ticks: first birth at
tick 2525, ten by the end, population 1024 → 1034, books still closing to the
joule. Reproduction is now slow and earned rather than impossible, which is what
the solar calibration was chosen for: only the fittest cross the threshold.

Both the GPU dispatch and the buffer sizing already handle a moving population —
`v2_renderer` reads `active_agent_count` from the uniform every frame and
dispatches from it, and the agent buffers are sized to the whole WASM array — so
growth needed no host change.

### Geometry — every agent is inside the torus

`PhaseLattice::grid_rows` takes the CEILING of `active / w`, mirrored in
`compute_toroidal.wgsl`. `wrap_index_2d` can only ever return an index in
`[0, h*w)`, so flooring left the agents past the last full row outside the grid:
they read eight neighbours and were the neighbour of nobody, drawing energy by
conduction and predation from counterparties that never paid it. The torus was
not closed.

Occasional when the population was fixed at ignition — and the normal case the
moment mitosis began growing it one birth at a time. **Every newborn was
appended outside the torus** and stayed invisible to the physics until enough
siblings arrived to complete its row.

The overhang in the other direction — indices in `[active, h*w)` that nobody
occupies — was already safe: both substrates skip a neighbour whose index is
`>= active_agent_count`, and they skip it symmetrically.

Measured, capacity 4096 over 5000 ticks: births 10 → 72, population 1034 → 1096,
books still closing (leaked 0).

The invariant is checked structurally rather than by energy sums. The obvious
assertion — `before == after + released` — is **vacuous** here, because the
dissipation ledger books exactly that difference and the identity holds whatever
the geometry does. The test asserts `h*w >= active` across a spread of
populations and row widths instead, and was confirmed to go red on the floor.

### Not synchronised — measured, and the cause is a unit mismatch

The Kuramoto coupling — the mechanism this project is named after, whose kernel
is published as the `kuramoto-coherence` crate — produces no measurable
synchronisation. `tools/structure_probe.ts`, capacity 4096 over 3000 ticks:

```text
order parameter, read in the agents' own phase wrap : 0.055 → 0.023
local order / global order (domain structure)       : 1.07
mean metabolic_efficiency of the living             : 128.4 → 128.9
```

Zero order, no domains, no drift in the trait selection acts on. Phase-gated
conduction was supposed to produce coherent clusters; measured, it produces
none.

**A 0.63 that is geometry, not physics.** Read through the kernel's own
trigonometry the order parameter looks like 0.63 — but agents wrap their phase
at `1<<q_phase = 128` while `SINE_LUT` spans 256, so the population is confined
to half the trigonometric circle, and a UNIFORM distribution there already reads
as 2/π ≈ 0.637 with no synchronisation whatever. The probe reports both readings
for exactly this reason.

That half-circle is a real inconsistency — `PhaseTopology::new` still asserts
`q_phase ∈ [2,7]` "for the 128-element SINE_LUT" while the physics indexes the
256-element one, so the table was widened and the wrap was not. But it is
**not** the cause: mapping the phase resolution onto the full circle was tried
and moved the order parameter from 0.045 to 0.042. A negative result worth
keeping.

**The cause is that natural frequency is assigned in Q10 and clamped in raw
phase units.** Ignition sets
`base_freq = (rng % BB_FREQ_RANGE - BB_FREQ_OFFSET) * BB_FREQ_Q_SCALE`, spanning
±2,048,000. `tick_physics` then clamps it against `max_phase / 2 = 63` — a bound
in raw phase units, against a value in Q10. Measured at ignition:

```text
905 distinct natural frequencies, range ±2,048,000
after the Nyquist clamp: 2 distinct values, -63 and +63
pinned to the rail: 1024 / 1024
```

Every agent rotates at exactly ±63 phase units per tick in a space of 128 — half
the circle per tick, maximal aliasing — split into two counter-rotating groups
with no internal variation at all. Coupling cannot synchronise that, and the
clamp whose comment says "Nyquist" is what puts every oscillator on the Nyquist
limit.

Fixing it means deciding where the Q10 boundary sits: divide `base_freq` by
`Q_SCALE` in the drift, or clamp in Q10 and keep the units through. Either
changes every agent's trajectory, so it changes the era, every golden trace and
the law hash — which is why it is recorded here with its measurement rather than
taken quietly.

### Not conserved yet — known, named, open

Listing these is the point. A conservation section that implied closure it does
not have would be the same failure as the tautological audit above.

1. **Dissipation is aggregate, not attributed.** The boundary ledger records
   that a joule was spent, not on what. Burn, clamp loss and any future leak
   arrive indistinguishable. That is the correct quantity for a thermodynamic
   trace and the wrong one for diagnosing a regression, so a leak introduced
   tomorrow would be absorbed silently into a number that has a legitimate
   reason to grow.
2. **`total_entropy_released` still has no consumer.** It accumulates and is
   read for telemetry and time dilation, but nothing draws ATP back out of it.
   Until something does, omega is thermodynamically a decaying box rather than a
   cycle — every joule eventually reaches the trace and stops. The units are
   bounded now and the trace is finally true, so the return path is buildable;
   it has not been built, and inventing it is a decision about what the world
   is, not a repair.
3. **Proper time is still the host's `+1`.** The kernel law
   (`1024 / (1 + stress/32)`) never runs on the substrate that does, so time
   dilation — stressed regions ageing more slowly — is a documented mechanic
   with no execution. Applying the kernel law verbatim would cycle `day_phase`
   once per tick, which is why the host's counter exists; the two paths carry
   genuinely different unit assumptions, and reconciling them changes how the
   world looks, not just what it accounts for.
