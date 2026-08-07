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

### Phase dynamics — two Q10-against-raw errors, and what fixing them did

The Kuramoto coupling this project is named after produced no measurable
synchronisation: order parameter 0.02, no domains, no drift in the trait
selection acts on. Two unit errors, found by measuring rather than reading.

**The coupling term carried a factor of 1024 too many.** `total_coupling` is
already a Q10 mean-field quantity and `k` is Q10, but the result was divided by
`6 * Q10_SCALE` once and added directly to a phase of 0..127. Measured with
`base_freq` zeroed, so that coupling was the only thing moving anything: median
displacement 8 phase units per tick, maximum 64, and **132 of 256 agents moved
by a quarter of the phase space in a single tick**. Every tick randomised the
lattice. One more division puts it where it belongs — a small pull toward the
neighbourhood mean.

**The Nyquist clamp read `base_freq` in the wrong units.** Ignition writes it as
Q10 (`... * BB_FREQ_Q_SCALE`); the clamp compared it against `max_phase / 2`, a
raw phase bound. Measured at ignition: **905 distinct natural frequencies going
in, 2 coming out — −63 and +63 — with 1024 of 1024 agents pinned to the rail.**
Two counter-rotating groups at the aliasing limit, with no internal variation.
The clamp whose comment reads "Nyquist" was what put every oscillator _on_ the
Nyquist limit.

Measured after both, capacity 4096 over 3000 ticks:

```text
order parameter   0.055 → 0.413
population        1024  → 4096   (carrying capacity; was 1024 → 1054)
mean efficiency   128.4 → 131.0  (was 128.4 → 128.9)
```

The world synchronises, fills its habitat, and the trait selection acts on
actually moves.

**A refuted hypothesis, kept.** The first suspect was the phase space: agents
wrap at `1<<q_phase = 128` while `SINE_LUT` spans 256, so the population lives
on half the trigonometric circle — where a _uniform_ distribution already reads
as 2/π ≈ 0.637 and looks like order. That inconsistency is real, and
`PhaseTopology::new` still asserts `q_phase ∈ [2,7]` "for the 128-element
SINE_LUT" while the physics indexes the 256-element one. But mapping the
resolution onto the full circle moved the order parameter from 0.045 to 0.042.
It was not the cause, no law was changed on the strength of it, and
`structure_probe.ts` reports both readings so that 0.63 is never again mistaken
for synchronisation.

**What the world does now, measured tick by tick.** The first reading of this
was wrong and the correction is the interesting part. The probe sampled every 50
ticks and reported observables identical to four decimals from tick 800 on,
which read as a fixed point. Sampled every tick instead: 40 consecutive states,
40 distinct hashes — the instrument had aliased, the same failure just removed
from the physics, reintroduced in the thing measuring it.

Then the phases themselves: **4091 of 4096 agents advance by zero**. Not
rotating, not fluctuating. Frozen, while energy churns underneath and keeps the
state hash moving.

The cause is `FLAG_TISSUE_LOCKED` — "Emergent Organ Differentiation (Tissue
Crystallization)" — and it is a designed mechanic doing exactly what it says. An
agent that is rich (`energy > MAX_ATP - 1000`), aligned (`ortho > 0`) and
unstressed (`thermodynamic_stress < 5`) is set structurally rigid: `base_freq`
zeroed, Hebbian weights maxed. Nothing anywhere clears the flag.

```text
tick    alive   order   tissue
   1     1024   0.077     0.0%
 280     4096   0.058     0.0%
 400     4096   0.349    86.8%
 520     4096   0.412    99.9%
 640+    4096   0.413   100.0%
```

The chain is coherent, and it explains the order parameter honestly: **coupling
pulls neighbours into local alignment → alignment lowers thermodynamic stress →
low stress plus the wealth of a population at carrying capacity trips
crystallisation → tissue freezes that alignment in place, permanently.** So the
0.413 is real coherence, but it is _fossilised_ coherence. The world
synchronises, fills its habitat, grows rich, and turns to stone.

**Tissue is now relative and reversible, and the world breathes.** Three knobs
were visible; two were turned and the third deliberately left alone.

_Relative._ The threshold was `MAX_ATP - 1000`, a fixed wealth line that every
agent crosses once the population is at carrying capacity and the sun outpaces
metabolism. It is now `max(p90_energy, MAX_ATP/2)` — being in the top decile is
a claim about your neighbours, so it cannot become universal by construction.
The floor guards the degenerate start before the histogram has run.

_Reversible._ Nothing cleared the flag, so the first agent to qualify was
structure forever. An agent that falls out of the top decile or meets stress
again dissolves back to motile. `base_freq` is no longer zeroed on
crystallisation — the drift is gated on the flag instead — because zeroing it
destroys the frequency there would be to return to.

_Left alone:_ tissue burns a quarter of normal. That is a subsidy, not a cost,
and it is why crystallisation ran away — but with a relative ceiling it can no
longer do so, and changing two things at once would leave neither measured.

```text
tissue fraction, capacity 4096 over 6000 ticks
  before:  0% → 100% by tick 640, and 100% forever
  after :  cycles 22% ↔ 96%, mean 48.6%
```

**Still not differentiation, and worth saying so.** What emerged is a global
oscillation — the whole population ossifying and dissolving together — not
spatial structure. A body has persistent regions that are structural while
others stay motile; this has phases in time rather than organs in space. The
local-over-global order ratio would show the difference and currently sits near
1, which is the same "no domains" reading as before. So the fossil is gone and
the organism is not yet there.

### Era 964 — the threshold became local, and the domains did not appear

`p90_energy` is a histogram over the whole lattice. Every other quantity an
agent reads — coupling, conduction, predation, stress — comes from its eight
neighbours; this one term let an agent's fate turn on a number computed
instantaneously over every other agent alive. **That is action at a distance,
and it is the whole argument for this change.** The threshold is now
`max(mean(living neighbours' energy), MAX_ATP/2)`, accumulated in the loop that
was already reading those neighbours. The floor still stops the local king of a
starving patch from counting as structure.

_What I predicted, and did not get._ A crystal burns a quarter as much, so it
accumulates; conduction spills some of that into its neighbours, raising their
bar. Lateral inhibition of that shape is the standard way a uniform medium
resolves into patches instead of flipping as one — so I expected spatial
domains, and built the instrument to see them before looking: the probe now
reports how much more likely a tissue cell's neighbour is to be tissue than any
cell's neighbour is. 1.0 means the flag is sprinkled at random; either direction
away from 1.0 is structure.

Measured against the Era-963 law as a control, 1204 samples each:

```text
tissue band   Era 963 (global p90)   Era 964 (local mean)
  5–15%       2.10  (n=20)           1.11  (n=400)
 15–30%       1.11  (n=412)          1.95  (n=406)
 30–50%       1.27  (n=69)           1.30  (n=156)
 50–70%       1.16  (n=66)           1.04  (n=190)
 70–99%       1.02  (n=364)          —
```

The effect reverses sign between adjacent bands. **Refuted.** The aggregate
figure that looked like a win — clustering 1.10 → 1.33 — is almost entirely a
confound: a lattice that is 96% tissue has clustering 1.0 by arithmetic, and Era
963 spent most of its cycle up there. Matching on fraction dissolves it. This is
the third hypothesis of mine kept in the record after measurement killed it,
next to the half-circle phase space and the frequency spread.

What did change is real but smaller than the story: the fraction wanders
irregularly in 0–61% instead of square-waving 22 ↔ 96, and the physics no longer
contains a global broadcast. Neither law makes organs.

### Era 965 — the synapses were never connected

`tick_physics` read two learned weights out of `memory[1]`/`memory[2]`, updated
them by a Hebbian rule against the left and right neighbours' coherence, clamped
them, raised them to `HEBBIAN_MAX_WEIGHT` on crystallisation, and wrote them
back. Above the mean-field sum, a comment: _"Kuramoto coupling modulated by
Hebbian weights."_

It was not. The sum multiplied every neighbour by the **constant**
`HEBBIAN_DEFAULT_WEIGHT`, and the normalisation three lines down divided by that
same constant, so the two cancelled exactly. The shader had gone further and
cancelled them algebraically, with a comment noting they cancel — the clearest
possible statement of the defect, sitting in the code for four eras. A learning
rule ran every tick on every agent and wrote to a location nothing read.
`HEBBIAN_MAX_WEIGHT` sat in the law-hash preimage and under the shader's
constant lock the whole time, guarding a drift that could not have mattered.

Each neighbour now carries the synapse the agent learned for it, and the
normalisation is the mean of the weights actually used — so a strong synapse
changes **whom** an agent listens to, not how hard it is pulled. Normalising by
the constant instead would have reintroduced the Era-962 blowup, where a
mis-scaled coupling displaced agents by a quarter of the phase space per tick.

`omega_v2/tests/hebbian_is_load_bearing.rs` asserts the property rather than the
mechanism: two worlds identical except for their stored weights must not compute
the same phases. Written against the broken kernel first, where the two
trajectories came out bit-identical.

_And it did not produce domains either._ Local-over-global order 1.093 → 1.092
over 1204 samples. Three attempts now — a local threshold, reversible tissue,
live synapses — and that ratio has not moved off 1. Shipped anyway, because a
dead term claiming to be live is a defect on its own terms.

**The structural limit worth naming:** an agent has synapses only along x, two
of its eight neighbours, because it has three memory words and cannot store
more. That asymmetry is a property of the data structure, not a modelling
choice, and any real account of domains probably has to start by changing it.

### The parity harness could report a build as a divergence

While landing the above, `tests/wgsl_golden_trace_test.ts` reported six failures
across substrates. There was no divergence: `cargo test` builds its own binary
and passed, the `.wasm` was never rebuilt, and the harness compared an Era-964
kernel against an Era-965 shader. Three bisection experiments went into chasing
it.

The harness reads the shader from **source** and the kernel from a **built
artifact**, and had every byte it needed to notice. It now refuses to run when
the wasm is older than `lattice.rs`, `constants.rs`, `math.rs` or `topology.rs`
— as a test of its own, not a check inside the GPU-init path, where the failure
was swallowed and downgraded to a skip.

A test that can be red for reasons unrelated to its subject is worse than no
test, because it is believed.

### Era 966 — the phase circle had a seam, and the order parameter was geometry

`sin_q10(from, to)` indexes `SINE_LUT` — 256 entries, one full period — with
`(to - from) & 0xFF`. Agents wrapped their phase at `1 << q_phase` = 128. The
space the agents lived in was **half** the space the physics measured.

That is not a scale factor. Two agents at phase 0 and phase 127 are one step
apart on a circle of 128 — the coupling should pull them together. Measured:

```text
cos_q10(0,   1) =  1024   perfect agreement
cos_q10(0, 127) = -1024   perfect opposition
```

Those are the two neighbours of phase 0, mirror images of each other, read as
opposites. Conduction is gated on that cosine, so an agent shared energy freely
with the neighbour on one side and refused the identical one on the other, for
no reason but which side of the wrap it sat on. Half the phase span read as
orthogonal instead of antiphase, so the coupling never fully reversed and there
was no restoring force toward agreement across the seam.

`q_phase` is now 8, which makes the agents' circle exactly the table's circle.
Nothing about the trigonometry changed — the two circles became the same one.
The old bound `q_phase ∈ [2,7]` was justified in a comment as being "for the
128-element SINE_LUT", which names a table the physics does not use: nothing
calls `sin_topo`/`cos_topo`, the only readers of `SINE_LUT_128`.

**The reported order parameter was the same artifact.** A uniform distribution
on half a circle reads as 2/π = 0.637 through a table twice as wide. The 0.41
that Era 962 recorded as synchronisation was below that baseline — it was
geometry. Read in the agents' own wrap, this world has never synchronised: 0.055
before, 0.015 after.

_And closing it did not create domains._ Bias-corrected local order, read in the
agents' own wrap on both sides so the two are comparable:

```text
                  global    local*    ratio
q_phase=7 (seam)  0.0546    0.1461     2.68
q_phase=8 (closed) 0.0152    0.1454     9.55
        * bias-corrected; 0 = indistinguishable from random in the neighbourhood
```

Local coherence is unchanged to three decimal places. The ratio improved because
the **denominator** shrank. Shipped because adjacent phases reading as antiphase
is indefensible on its own terms, not because it produced anything.

### The structure probe was measuring its own sample size

`structure = localOrder / globalOrder` compared an order parameter over eight
neighbours against one over four thousand agents. The order parameter has a
floor that depends on sample count: for eight random phases E[r] ≈ √(π/32) =
0.31, so local order could never read below 0.31 no matter how disordered the
neighbourhood.

That floor, divided by an inflated global figure, produced a ratio of ~1 for
five eras — read as "no domains", which happened to be true — and jumped to 37
the moment the half-circle artifact was removed from the denominator, which
would have been read as "domains!" Both numbers were sampling.

Local order is now bias-corrected (`R² = (k·r² − 1)/(k − 1)`) and reported in
the agents' own wrap as well as the table's — and the correction alone was not
enough. `R̂²` is unbiased but noisy, and over eight neighbours it lands negative
about half the time; taking `√max(0, R̂²)` per agent and averaging those keeps
every upward excursion and floors every downward one, so the result is strictly
positive whatever the world does. Measured against a field whose true order
parameter is 0 by construction, that estimator returns **0.12**. omega's "local
coherence" was 0.145, and it did not move when the coupling was switched off,
when reproduction was switched off, or across five eras of physics changes —
because it was reporting `k`.

The average is now taken over `R̂²` unclipped, where the errors cancel, and the
square root once at the end. `src/shared/order_parameter.ts` holds it;
`tests/order_parameter_test.ts` pins it against fields with known R — 0, 0.3,
0.6, 0.9 — and includes a guard showing the UNCORRECTED statistic really does
sit at the √(π/4k) floor on the same fixture, so the assertions test the
correction rather than the fixture.

Four hypotheses about domains have now been measured and refuted; the first
three were measured with this instrument.

### The only structure in this world is not made by the coupling

With the estimator fixed (above), local phase coherence is **real**: 0.114,
against 0.000 for a synthetic field of the same shape whose true order is zero
by construction. That is the first positive structural result omega has produced
— a genuine spatial correlation, neighbours agreeing with each other more than
they agree with the population.

It is not made by the Kuramoto coupling. Three knockouts, each measured with the
corrected estimator, each a single diagnostic edit reverted afterwards:

```text
                      global    local
baseline               0.0152   0.1141
coupling forced to 0   0.0153   0.1121
reproduction disabled  0.0295   0.1103
time dilation forced 1 0.0172   0.1283
```

Zeroing the coupling term entirely — the term this kernel is named for, the one
two eras were spent repairing — moves local coherence by 2%. Removing
reproduction removes the inheritance path and moves it by 3%. Removing time
dilation moves it UP.

**The source is phase-gated conduction, acting through crystallisation.** Two
more knockouts, and then both together to tell a chain from two parallel paths:

```text
                          global    local
baseline                   0.0152   0.1141
conduction ungated         0.0137   0.0322
crystallisation disabled   0.0142   0.0427
both disabled              0.0161   0.0429
synthetic field, true R=0     —     0.0000
```

Disabling both is indistinguishable from disabling crystallisation alone —
0.0429 against 0.0427. Once nothing freezes, the gate makes no further
difference. The two are **serial**, not additive, and the chain is:

1. Conduction is gated on `cos(θ_n − θ_a)`, so neighbours in phase pool energy
   and neighbours out of phase do not. Energy becomes spatially correlated with
   phase similarity.
2. Crystallisation fires in the energy-rich patches and sets `drift = 0`.
3. Frozen neighbours cannot move apart, so they keep whatever phase they had.

Note what that makes the 0.114. It is not oscillators finding each other. **It
is cells that stopped.** A crystal is coherent because it is not moving, and the
measure cannot tell that from agreement — which is precisely why the tissue
fraction has to be read alongside it, and why `structure_probe.ts` reports both.

Ignition is ruled out by inspection: `ignite_big_bang` draws phase from
`Xorshift64`, so there is no spatial birthmark to inherit. A residual 0.043 sits
above the random-field floor and survives both knockouts; it is not accounted
for, and is not claimed to be anything.

What can be said plainly: the global order parameter is 0.015, the Kuramoto
coupling accounts for about 2% of the only local structure this world has, and
that structure is arrested motion rather than synchronisation. The mechanism the
model is built around is not the mechanism doing the work.

### Nothing moves together — and Era 967, the oscillators were saturated

Once local coherence turned out to be frozen tissue, the question changed. A
living region would show the opposite signature: cells that advance TOGETHER
while still advancing. That is a correlation of velocities, not of phases, and
nothing here measured it.

`src/shared/spatial_correlation.ts` (Moran's I over the phase velocity,
`tests/spatial_correlation_test.ts` pinning it at ≈0 on noise, >0.7 on blocks,
<−0.9 on a checkerboard, and exactly 0 on a frozen field — a crystal has no
velocity variance and drops out rather than dominating).

Measured on Era 966: **−0.0019** across the living, **−0.0016** among the motile
alone, range −0.032 to +0.035. There are no coordinated regions. None, at any
sampled tick.

**Why became visible once the coupling was compared against what it competes
with.** `memory[0]` holds the tick's coupling term, so both can simply be read:

```text
phase span                     256
mean |coupling|              0.107  phase units/tick
mean effective |base_freq|   124.9  phase units/tick
at the Nyquist clamp         95.0%  of the living
coupling share of the advance 0.086%
```

`BB_FREQ_RANGE = 4000`, `BB_FREQ_OFFSET = 2000`: the Big Bang drew natural
frequencies from ±2000 phase units per tick, against a clamp at ±max_phase/2 =
±128. Ninety-five percent of the population sat exactly at the cap — four
thousand distinct draws collapsing onto two values, every agent turning half the
circle per tick, which is precisely the rate at which forward and backward stop
being distinguishable.

That is Era 962's bug in a second place. Era 962 fixed the clamp, which had been
reading a Q10 value against a raw bound and collapsing 905 frequencies to two.
The distribution feeding the clamp was never looked at.

`BB_FREQ_RANGE` → 64 and `BB_FREQ_OFFSET` → 32 put the draw at a quarter of
Nyquist. Measured after: **0% clamped**, mean effective frequency 16.2.

_It did not synchronise anything._ Global order 0.0152 → 0.0144, velocity
correlation −0.0016 → +0.0083, local phase order 0.114 → 0.053. Coupling is
0.105 against a spread of 16.2 — 0.6% of what moves a phase, where Kuramoto
locking needs the two to be comparable. **That is the next knob and it is
deliberately untouched**, so this one stays measured.

The three `BB_FREQ` constants are now in the law-hash preimage. They set the
phase dynamics of every organism the world creates and sat outside it, which is
exactly the defect Era 961 closed for nine others. They are also edited in
`src/ontology/genesis_ssot.ts` rather than `constants.rs`, which is generated —
the first edit went into the generated file and the generator quietly restored
it.

### The coupling cannot be turned up — it rounds to zero

Era 967 ended with an obvious next move: the coupling is 0.6% of what moves a
phase, so raise it until it is comparable to the frequency spread, which is what
Kuramoto locking requires. Swept `KURAMOTO_COUPLING_BASE` over 1024..524288 and
measured neighbour velocity correlation at each point:

```text
K         |coupling|   velocity correlation
1024          0.10          +0.0083
8192          2.23          +0.0081
16384         4.68          +0.0193
24576         7.13          +0.0369
32768         9.46          +0.0456
49152        13.74          +0.0542   ← apparent peak
65536        19.30          +0.0227
131072       41.23          −0.0004
```

That looked like a result, and the control supported it: at K=1024 with
crystallisation disabled the correlation is +0.0007, so the rise was not simply
the loss of frozen cells.

**A unit test refused it, and was right.** `test_tick_physics_kuramoto_coupling`
seeds 256 agents with `base_freq = 0` — zero frequency spread, the case where
any positive coupling must converge — and asserts the order parameter rises.
Sweeping the same K through that fixture:

```text
K = 1×1024   converges
K = 4×1024   0.046 → 0.087
K = 8×1024   0.046 → 0.016
K = 16×1024  0.046 → 0.057
K = 24×1024  0.046 → 0.040
K = 32×1024  0.046 → 0.069
K = 48×1024  0.046 → 0.031
```

Only the current value converges. Above it the numbers are noise, not a trend:
the coupling stops building order and starts destroying it, immediately. So the
velocity correlation at K=49152 is far more likely the signature of an unstable
integrator kicking neighbours in correlated ways than of coordination. **Not
shipped.** The sweep is recorded because the refutation is the useful part.

**Why raising it cannot work.** `coupling` is an `i32` added directly to an
integer phase, and:

```text
mean |coupling|                  0.103
coupling EXACTLY zero    89.7% of living agents, every tick
mean effective |base_freq|      16.19
```

The coupling is not weak. For nine agents in ten it **does not exist** — the
mean-field term truncates to zero before it reaches the phase. And the next
representable value above zero is 1, so there is no setting between "absent" and
"a step large enough to overshoot". That is the whole shape of the sweep.

_The named next step, not taken here:_ the coupling needs sub-unit resolution —
a per-agent fractional phase residue, so a pull of 0.1 accumulates into one
whole phase unit over ten ticks instead of vanishing ten times. The open design
question is where the residue lives: an agent has three memory words,
`memory[0]` already carries the coupling for diagnostics and a parent hash
through mitosis, and widening the agent touches the ABI, the shader struct and
the ZK guest.

### Era 968 — the phase advance stopped discarding its fractional part

Every term that moves a phase — natural frequency, Kuramoto coupling, attractor
drift — was truncated to a whole phase unit before it reached `agent.phase`. The
coupling's mean magnitude was 0.103 units, and it was **exactly zero for 89.7%
of living agents every tick**. For nine agents in ten the term this kernel is
named for did not act. Not weakly — at all.

The whole drift is now summed at Q10 and the remainder banked in the low ten
bits of `memory[0]`, euclidean so the bank never runs backwards. A pull of 0.1
becomes one whole unit after ten ticks instead of vanishing ten times. Tissue
banks nothing, so an agent that dissolves back to motile resumes from a clean
residue rather than discharging a debt accumulated while it was frozen.

`omega_v2/tests/coupling_below_one_quantum.rs` asserts the property rather than
the mechanism: with `base_freq` zeroed, so the coupling is the only term that
can move anything, an agent must eventually move. Verified RED — **14.3% of the
population had bit-identical phases after 512 ticks**.

_It did not synchronise the world._ Global order 0.0147 → 0.0149, velocity
correlation +0.0083 → +0.0105, local phase order 0.0510 → 0.0533. Shipped
because a force discarded nine times in ten is a defect on its own terms, and
because resolution is now an axis that can be tuned at all.

Two things that axis immediately showed, both measured and left unshipped:

```text
BB_FREQ_Q_SCALE   spread    global   velCorr    localPhase   tissue
     1024          ±32      0.0143   +0.0071      0.0507      0.273
      128          ±4       0.0154   −0.0003      0.0256      0.001
       32          ±1       0.0278   −0.0008      0.0318      0.000
        8          ±0.25    0.0240   −0.0009      0.0309      0.000
```

Narrowing the frequency spread toward the coupling's scale doubles global order
— to 0.028, which is still nothing — while extinguishing crystallisation
entirely and driving coordinated motion to zero. Not a trade worth taking.

And the Sakaguchi lag still does not matter. Swept 0°–90° with the coupling now
acting, steady-state order tail-averaged over 30000 ticks: 0.088, 0.095, 0.156,
0.106, 0.139, 0.125. No trend. α was expected to become measurable once the
coupling could act; it did not.

### A convergence test that was passing on a coin flip

`test_tick_physics_kuramoto_coupling` read the order parameter once at 2500
ticks and required `after > before + 0.1`, on the grounds that Kuramoto's claim
is that a coupled population converges — with every natural frequency zeroed,
that should mean r → 1 for any positive coupling.

It does not. Tail-averaged over 30000 ticks at six different lags the order
wanders in a band around 0.12, a little above the N=256 sampling floor of
√(π/4N) = 0.055, and never climbs. A single reading at 2500 ticks lands on
either side of the threshold depending on where in that wander it falls. The
assertion was not measuring convergence; it was sampling noise, and it had been
adjusted once already to make it pass.

It now asserts what the coupling demonstrably does — lifts the population off
its starting arrangement and holds it measurably higher — which is
discriminating rather than merely weaker: with `base_freq` zeroed and no
effective coupling the phases are bit-identical at tick 30000 and the order is
exactly `before`.

### This world evolves exactly once, and then stops forever

Eight eras went into the phase layer. None of them asked the question the
project is actually named for: does the population EVOLVE?

The instrument could not have answered it. `ecology_probe.ts` counted births and
not deaths — so a world at capacity with no mortality at all reported the same
health as a thriving one. It counts deaths by transition now, slot by slot,
every tick: the kernel exposes no death counter, and inferring one from
population change would miss every death a birth backfilled in the same sweep,
which in a full world is all of them.

What it says about the default environment:

```text
tick    alive   births   deaths
1       1024        0        0
550     4096     3072        0
2000    4096     3072        0
20000   4096     3072        0
```

Nothing is born and nothing dies after tick 550. Every birth was fill-up (3072 =
4096 − 1024). And the trait the physics selects on freezes with it:

```text
metabolic efficiency, weather 1024
  tick 1      128.35     (the ignition distribution)
  tick 2400   133.32
  tick 20000  133.32     ← identical to the second decimal
```

Full range intact — min 0, max 255 — so the variation is there. Nothing acts on
it.

**Harsher weather does not fix it, it only moves the freezing point.**
`weather_multiplier` scales metabolic maintenance and is a Layer B parameter, so
this sweep changes what the world costs to live in without changing what it is:

```text
weather   alive   births   deaths   deaths at 5k / 10k / 20k
 1024      4096     3072        0     0 / 0 / 0
 5120      4096     3079        7     7 / 7 / 7
 5632      4096     3134       62    62 / 62 / 62
 6144      4096     3151       79    76 / 79 / 79
 7168      1696      674        2     — sterile, never fills
```

Turnover is a **transient**, at every setting. A few dozen agents die on the
approach to equilibrium and then the world freezes again. Above ~7000 the world
does not freeze full, it fails to fill at all: metabolism eats the surplus
before anything reaches the reproduction threshold. There are two regimes,
frozen and sterile, and no band between them.

The trait behaves the same way. At weather 5632 efficiency reaches 150.08 by
tick 2500 — a much larger shift than the default's 133.32 — and then holds it to
tick 20000 without moving. Harsher weather filters harder during the fill and
then stops just as completely.

**So this is a single-generation filter, not an ecology.** Selection runs once,
while the lattice is filling, and never again. Once every slot is occupied,
mitosis has nowhere to put a child and nothing ever dies to make room.

_A hypothesis of mine, refuted in passing._ Conduction is the strongest transfer
in the model and equalises energy between neighbours, so it looked like the
thing erasing the differences selection needs. Disabling it at weather 5632
raises deaths from 62 to **6524** — a hundredfold — and the trait drifts _less_:
+16.0 against +21.7 with conduction on. Turnover and selection are not the same
quantity here, and the drift is driven by which agents reproduce, not by which
die.

_What the next lever probably is, unmeasured and therefore unclaimed:_ death is
reachable only through energy hitting zero, and at equilibrium every agent's
income covers its burn, so nothing is ever marginal. `signals.p90_age` and
`BIRTH_TICKS` already track age and nothing consumes them. A world where age
itself is fatal would have to keep replacing its population, which is the one
condition under which selection can act more than once.

### Era 969 — the world evolves

Maintenance now rises with AGE, until an agent's upkeep outruns what
photosynthesis pays it. Age is packed into `state_flags` bits 8..23, which
nothing used. **Death stays an energy outcome** — no separate mortality rule —
so `death_entropy` books it and the conservation ledger closes exactly as
before.

**The rate is heritable, and it has to be.** With one lifespan for everybody the
population ages as a single cohort. Measured at a uniform `SENESCENCE_TICKS`:

```text
tick    alive   deaths
10000    4055       62
20000    4096     4120   ← everything born during the fill, dying together
40000    4096     8360   ← the wave returns, larger
60000     349    12285   ← collapse
```

Scaling the clock by the `resilience` gene spreads lifespans about fivefold.
That gene is called resilience, is decoded from the genome and inherited through
mitosis, and until now only ever subtracted 0 or 1 from the burn — it had
nothing worth deciding. Now it decides how long you live.

```text
tick     alive   efficiency   resilience
1         1024      128.35       125.13
9600      3881      131.53       135.31
19700     3883      131.77       137.95
29800     3229      131.40       150.63
39900     2218      126.52       173.10
60000     4006      118.67       180.61
```

**Resilience rises 125 → 181, monotonically, over 60000 ticks.** That is
directional selection on the trait senescence acts on, and it is the first time
anything in this repository has evolved. The comparison is not a statistical
control but it does not need to be: in Era 968 the population was frozen from
tick 550 — no births, no deaths — so no trait could move at all, and metabolic
efficiency was identical to the second decimal ten thousand ticks apart.

Metabolic efficiency appeared to move the other way, 128 → 119, and was recorded
as unexplained rather than as a trade-off. **Correctly** — over 200000 ticks it
turns around and returns to 139. The 60000-tick reading was a transient, and had
it been published as a trade-off it would have been wrong.

The population still oscillates — it dips to 2218 around tick 40000 and recovers
to 4006 — so the cohort wave is damped rather than gone. `SENESCENCE_TICKS` is
in the law-hash preimage (25 words now; the buffer was exactly the size of the
old 24, so the next law to join would have panicked on a slice bound rather than
failing a test).

### Two packing bugs, and what they looked like

`AGE_MASK` was written `0x0001_FF00` — nine bits, saturating at 511 — beside a
comment promising seventeen and a ceiling of 131071. Senescence therefore capped
at a fixed multiplier a few thousand ticks in, the population died back once and
then stabilised, and that is **indistinguishable from the frozen world the
change was meant to fix**. Widened to seventeen bits it then overlapped
`BIRTH_NEAR_ATTRACTOR_FLAG` on bit 24, so clearing a newborn's age erased the
record of where it was born; two existing tests caught that one.

A packed field is a claim about which bits belong to whom, and nothing was
checking it. `population_turns_over.rs` now asserts the width, the saturation
and non-overlap with every flag sharing the word.

### Era 971 — longevity costs what it buys, and the answer stops being the same everywhere

Era 970's resilience had no price. It divided the senescence rate and nothing
else, so more was always better and the trait climbed for 200000 ticks without
turning. **A gene with no downside is a ratchet, not a strategy**, and a world
with one ratchet has one answer.

Repair machinery costs energy to keep. Upkeep is now scaled by the same factor
that slows ageing, so resilience trades cost for time one for one: a maximally
resilient agent pays five times the maintenance and ages five times slower.

The trait reverses — from 125 down to about 62, and holds there. Neither bound;
an interior value. And **the value depends on the world**:

```text
weather   equilibrium resilience   (100000 ticks, tail-averaged)
  512             124.1
 1024              71.5
 2048              56.4
 3072              55.3
```

Cheap world, longevity pays. Harsh world, live fast and skip the repairs. The
same starting genome distribution finds a different answer under a different
sky, by selection alone — which is the difference between a gradient and an
adaptive landscape, and the first thing here that behaves like an ecology rather
than a physics.

Turnover rose with it: 12315 births and 9697 deaths over 60000 ticks, against
7479 and 4407 under free longevity. The books still close and nothing leaks.

_Left alone deliberately:_ `resilience_reduction` still subtracts 0 or 1 from
the burn a few lines below and now pulls against this. It is at most 1 ATP
against an upkeep reaching 20, and turning two knobs would leave neither
measured.

### Era 972 — the sun stops falling on everything equally

Era 971 showed the equilibrium resilience tracks the world: 124 in a cheap one,
55 in a harsh one. But with the sky uniform there was only ever **one** world,
so the whole population converged on a single value. Two strategies cannot
coexist where there is only one place to live.

The grid's y axis is now latitude — row 0 the equator, row h/2 the pole, which
on a torus is one bright band and one dark one. Insolation falls by
`LATITUDE_AMPLITUDE_Q10` toward the pole and **nothing else changes**: same
laws, same costs, different light.

_And birth became local._ `next_dead_idx` was a global forward scan, so a child
landed at the first vacancy anywhere in the lattice and the gene pool remixed
completely every generation. A child now takes a vacancy among its parent's
eight neighbours when there is one. The physics of birth is unchanged; only
where the child is put — the difference between inheriting a place and
inheriting only a genome.

```text
resilience by latitude, tail-averaged over 150000 ticks
                    equator  mid1  mid2  pole   spread
  global dispersal    58.9   56.8  55.1  53.9      5.0
  local dispersal     76.6   76.0  72.8  69.4      7.2
```

A cline, monotone, in the direction predicted before it was measured: the rich
band pays for longevity, the poor one does not. Local dispersal widens it by
half again.

**It is much shallower than it could be** — seven units, where the same
environmental range moves the trait seventy under a uniform sky. One cell of
dispersal per generation still mixes the bands faster than selection separates
them. Recorded as it stands, not claimed as more.

Turnover roughly doubled with it: 22364 births and 19292 deaths over 60000
ticks, against 12315 and 9697.

_The anchor was blind to this too._ At q_radial=6 the grid is 64 wide, so its
64-agent fixture was **one row tall** — every agent at the same latitude, and
the entire latitude law outside its reach. It is 256 agents now, four rows, the
minimum that can tell an equator from a pole. That is the third fixture gap this
session: tissue, then age, now latitude.

### How much of the cline does mixing eat? 57%.

Era 972 left a claim to check rather than a knob to turn: the cline is seven
units where the same environmental range moves the trait seventy under a uniform
sky, and one cell of dispersal per generation was blamed. Blame is not a
measurement.

The upper bound is what each band would reach if it were a world of its own.
With latitude switched off (`LATITUDE_AMPLITUDE_Q10 = 0`) and the metabolic cost
set to each band's own effective environment — computed from the insolation the
latitude formula actually delivers there — in the same physics:

```text
band       insolation  weather-equiv   isolated   in the cline   excess
equator          993          1056        66.2          76.6      +10.4
mid1             800          1310        63.8          76.0      +12.2
mid2             514          2040        62.1          72.8      +10.7
pole             297          3532        49.4          69.4      +20.0

spread                                    16.8           7.2
```

**The cline realises 43% of what isolation would give.** And every band sits
above its own optimum, the pole by twenty units — it is receiving migrants from
richer latitudes faster than selection can purge them. That is migration load,
and it is largest exactly where the theory says it should be: in the smallest,
most extreme band.

_The dose-response confirms the mechanism rather than assuming it._ Cline width
against gradient strength, everything else fixed:

```text
amplitude   equator  mid1  mid2  pole   spread   alive
    0          59.5  60.7  59.0  60.0     −0.6    4096   ← null control
  384          56.4  54.2  55.5  54.9      1.5    4096
  768          76.6  76.0  72.8  69.4      7.2    4082
  960          72.8  67.6  68.8  66.5      6.3    3625
```

Zero gradient gives zero cline — **−0.6, within noise of nothing** — which is
the control that says the seven units at 768 are not an artifact of how the
bands are cut. Growth is super-linear from 384 to 768, twice the gradient for
five times the cline, as cline width ~ σ/√s predicts. And at 960 the cline
**falls** while the population starts dying: past a point the poor band does not
adapt, it empties.

So 768 is near the differentiation optimum for the current dispersal, the limit
is gene flow, and the way to a deeper cline is less mixing rather than a harsher
pole. Recorded before turning anything, because three knobs in a row had gone
the same way and the fourth needed a reason that was not "it worked last time".

### Dispersal and fecundity are the same resource — two refutations

The previous section ended with a plan: gene flow limits the cline, so reduce
dispersal. Before turning that knob, the assumption behind it was checked, and
it was false.

**89% of births were already teleporting.** Era 972 sends a child to its
parent's neighbourhood when there is a vacancy there and to the first free slot
anywhere when there is not. Counted over 60000 ticks at capacity: **2405 local
births against 19959 distant ones**. The neighbourhood of a living agent is
almost always full, so the fallback was not a fallback — it was the rule, and
the seven-unit cline was achieved with barely a tenth of dispersal being local.

That looked like an easy win. It was not:

```text
                         equator  mid1  mid2  pole   spread   alive
teleport fallback (972)     76.6  76.0  72.8  69.4      7.2    4082
local only, no fallback     77.4  80.7  77.9  73.2      4.2    2832
radius 2, no fallback       74.0  68.5  68.3  71.2      2.8    2778
radius 4, no fallback       63.2  66.6  66.3  69.1     −5.9    3255
radius 8, no fallback       76.2  74.6  72.9  68.8      7.4    3398
isolated-world bound                                   16.8
```

Refusing to place a child that has no room beside its parent **narrows** the
cline, and widening the search radius does not recover it. Every variant also
sits well below carrying capacity. Nothing here beats simply letting the child
teleport.

**Because a free cell is two things at once.** It is a dispersal destination and
it is a reproductive opportunity, and in this world they are the same resource.
Gene flow cannot be reduced by restricting where children may go without
reducing how often they are born at all — and selection acts through
differential reproduction, so the cure removes more differentiation than the
disease.

Decoupling them needs a different mechanism, not a different radius: something
that opens space near a parent specifically, or lets an offspring wait for space
instead of forfeiting. Neither is implemented and neither is claimed.

Era 972's behaviour stands unchanged. The two variants are recorded because the
refutation is the result.

### Predation is real, heritable, and has no neutral pairs

Three mechanisms in this kernel turned out to be doing nothing when finally
measured — the Hebbian weights, the Kuramoto coupling, the latitude the anchor
could not see. Predation had never been checked, so it was checked before
anything was built on top of it.

**It is not inert.** Over 20000 ticks at capacity:

```text
predation moved      1.21e9 ATP   (gain and loss identical to the byte)
conduction moved     1.67e9 ATP
predation share of all transfer   42%
```

Gain equalling loss exactly is the Era-961 conservation fix still holding under
a load three orders of magnitude larger than the tests exercise.

**And it is heritable — 0.44.** `species_advantage` derives the relationship
from `xorshift32_once(genome)`, an avalanche hash, and mitosis flips several
bits at once, so a child's place in the food web looked likely to be re-rolled
at every birth. Measured against a null taken from _unrelated_ genomes rather
than assumed from the shape of the return type:

```text
child agrees with parent on a 256-species panel   72.2%
two unrelated genomes agree                        50.6%
heritability, scaled between the two                0.44
```

Nearly half of a parent's position survives a birth. `predation_heritability.rs`
locks it: if the hash is ever changed in a way that destroys inheritance, 42% of
this world's energy quietly becomes a lottery, and that test is what would say
so.

**But there are no neutral pairs.** `species_advantage` returns 0 only for
genomes that are bit-identical, so **100% of neighbour comparisons are
antagonistic** — a parent and its own mutated child are predator and prey to
each other. There is no kin, and therefore no species: only a total antagonistic
ordering in which every relationship is one-directional feeding.

Whether that matters depends on whether relatives are neighbours at all, which
is measurable and was measured. Mean Hamming distance between genomes, 32 bits
wide:

```text
neighbouring pairs   13.55
random pairs         14.60   (not 16 — selection has narrowed the population)
excess relatedness    1.06 bits, 7.2% closer than strangers
```

So kin structure exists and is weak, which is what 89% teleporting dispersal
predicts. A similarity threshold on `species_advantage` would create species and
let a patch stop eating itself. That was the obvious next mechanism, so it was
sized before it was built — and it does not survive the sizing.

### Predation is a fair coin, and that is why none of it matters

**Kin are 4.3% of the flow.** Predation bucketed by the Hamming distance between
the two genomes, over 20000 ticks:

```text
hamming   share of pairs   share of flow
  0–3           1.50%           1.52%
  4–7           2.80%           2.79%
  8–11          7.79%           7.83%
 12–15         38.21%          38.17%
 16–19         40.82%          40.81%
 20–23          8.69%           8.70%
```

Flow tracks pairs to two decimals in every bucket, so the energy moved per pair
does not depend on relatedness at all. Kin neutrality would touch 4.3% of 42% —
under two percent of the energy budget.

**And it would move none of it.** The relation is antisymmetric, so removing
predation between kin removes a kin's gains and its losses in equal measure. The
expected net effect on a patch is zero.

That raised the sharper question, which had never been asked: does anyone win?

```text
mean win rate against a 512-genome panel   0.500
sd across genomes                          0.0124
sd a fair coin would give                  0.0221
ratio                                      0.56
```

The spread is not at chance — it is **below** it. `delta = ha − hb` puts the
winner in the lower half of the u32 ring, so a genome beats _exactly_ half of
any uniform panel rather than half on average, with less variance than
independent coin flips can produce.

So predation moves 42% of this world's energy and, in expectation, moves it
nowhere. **Being good at predation is not a thing an agent can be.** There is no
gradient to climb, and the 0.44 heritability measured above inherits a pattern
with nothing behind it. The food web is a perfectly fair zero-sum shuffle that
consumes nearly half the energy budget to accomplish it.

`predation_is_a_fair_coin_with_no_gradient` asserts that as the measured state
rather than a spread the world does not have. Giving the advantage a gradient
means deriving it from a trait instead of a hash — a real design decision,
because it would make 42% of the energy budget selectable in one step. The test
is there so that happens on purpose.

### What the fair coin actually buys

A zero-sum shuffle that cannot be selected on might still be doing something —
or it might be actively harmful, since random deaths are drift and drift swamps
selection. Both are testable by knockout, and the first attempt at reading them
was wrong in a way worth recording.

_A wobbly measurement, caught before it was published._ The structure probe at
150000 ticks said the population fell from 4082 to 3292 without predation; the
ecology probe at 60000 said it rose from 3539 to 3677. Opposite signs. The two
differ in horizon and in whether they report a final sample or a tail mean, so
neither number was worth anything. Matched runs — same probe, same horizon, tail
means both sides:

```text
                 alive (tail)   births   deaths   energy per agent
predation on          3749       48730    45672         719
predation off         3796       45554    43286         852
```

**The population does not care** — 1.3%, well inside the drift between runs. Nor
does the latitude cline: 7.2 with predation, 6.7 without.

What does change is the standing stock and the churn. Removing predation leaves
**18% more energy held per agent** and **6% less turnover**. So the food web is
neither a selector nor a waste: it converts stored energy into births and
deaths.

That is not nothing — turnover is the thing selection needs, and Era 969 exists
because there was none. But it is an expensive way to buy it: **42% of every
joule this world transfers, for six percent more turnover.** Whether that trade
is worth keeping is a design question, and it now has numbers attached instead
of a food-web metaphor.

Three things about predation are now settled, none of them what the name
suggests: it has no gradient, so nobody can be good at it; kin neutrality would
move under two percent of the budget and none of it on net; and its actual
function is churn, priced at seven joules moved per joule of turnover bought.

### Era 973 — the food web starts seeing the population it is part of

`species_advantage` compared avalanche hashes of the whole genome, under a
comment that has read _"asymmetric cyclic food web … ring distance"_ since it
was written. The measurements in the previous sections showed what it actually
was: a perfectly fair coin, beating exactly half of any panel and half of the
living population too, with less spread than chance allows.

The ring is now the predation **trait** — genome bits 8..15, the byte that was
always meant to be about an agent's dealings with its neighbours. `a` beats `b`
when it sits in the half-ring ahead of it. Rock-paper-scissors with 256 hands.

**It holds polymorphism, which nothing here has done before.** Shannon entropy
of the predation hand, over 150000 ticks:

```text
ignition   7.83
tail       7.30      (8.0 = flat across all 256 hands)
```

The trait refuses to converge. Every other trait in this world settles on one
value — resilience finds an optimum, efficiency finds an optimum — because the
selection on them points one way. This one points at whatever the majority is
doing, so the winner becomes the majority and the majority becomes the target.
That is the first time this lattice has held more than one strategy at once, and
it comes from the shape of the relation rather than from any gradient.

Two more things follow for free. Heritability of predatory identity rises 0.44 →
0.61, because one byte survives mutation better than a whole-genome hash. And
**equal hands are neutral** — kin recognition, reachable at last: the old rule
returned 0 only for bit-identical genomes, so a parent and its own mutated child
were predator and prey.

**And it cost the cline.** Latitude differentiation in resilience falls from 7.2
to 1.2. The likely cause is hitchhiking — a winning hand sweeps and drags its
whole genome, resilience included, faster than latitude can separate it — but
that is a hypothesis and it has not been measured. It is the price, recorded as
one, not explained away.

_Two obsolete locks replaced rather than deleted._
`test_species_advantage_zero_guard` and the WGSL sentinel lock both pinned the
hash and its `genome == 0` special case — a real past bug where the shader
hashed the sentinel and produced the opposite predator/prey sign in the
consensus path. That concern is structurally gone: no hash, no sentinel, no
branch to disagree about. What replaced them locks what matters now — both
substrates reading the same byte and splitting the ring at the same place,
either of which is silent and substrate-local if it drifts.

### Two corrections to my own record, and the error bars that found them

_The hitchhiking hypothesis is refuted._ Era 973 blamed the cline's collapse on
a winning hand sweeping and dragging its whole genome. If a hand were a recent
clonal expansion, agents carrying it would be more alike in an unrelated byte
than the population is. Measured — variance of resilience within a hand over
variance across the population:

```text
at ignition (random genomes, the null)   0.846
tail, 150000 ticks                       0.800
```

The null is 0.846 rather than 1.0 because a within-group variance over ~4
members is biased low, which is the number to compare against, not the
theoretical 1.0. Against that, hands are **nearly genetically independent**.
Whatever cost the cline, it was not linkage.

_And the cline numbers were published without error bars._ Every cline figure in
the sections above is a mean over samples from a single run, and consecutive
samples are serially correlated, so the naive standard error is worthless. Block
averaging — eight blocks over the tail, standard error across block means —
absorbs the autocorrelation:

```text
amplitude   as published   with block error bars
    0           −0.6        −0.54 ± 0.73
  384            1.5         1.58 ± 1.05
  768            7.2         7.16 ± 1.95
  960            6.3         6.30 ± 4.66
```

The means were right. The confidence was not.

**"Growth is super-linear from 384 to 768" does not survive** — the 384 point is
1.5σ from zero, so there is no established cline there to be super-linear from.
**Nor does "at 960 the cline falls"**: 6.30 ± 4.66 against 7.16 ± 1.95 is
nothing. What does survive is the pair that matters: no gradient gives no cline
(−0.54 ± 0.73), and amplitude 768 gives a real one (7.16 ± 1.95, 3.7σ).

Era 973's cost is weaker than stated too. The cline falls 7.16 ± 1.95 → 0.97 ±
2.22, a difference of **6.20 ± 2.96 — 2.1σ**. Suggestive, not established. The
naive figure was 8.6σ, wrong by a factor of four.

The lesson is not subtle and it applies to everything above: a tail mean from
one run is a point estimate with no stated precision, and this file has been
full of them. Where a claim rests on comparing two such numbers, it needs blocks
or replicates. Where it rests on a knockout that changes something by an order
of magnitude — predation moving 42% of transfer, the coupling being exactly zero
for 89.7% of agents, the population frozen at 3072 births forever — it does not.

### The polymorphism claim, with the control it was missing

Era 973 reported the predation hand at Shannon entropy 7.30 against a maximum of
8.0 and called it maintained polymorphism. That number had nothing to be large
or small against. A byte under **no** selection would also stay spread — drift
is slow with 4096 agents — so "it did not converge" is not evidence of anything
on its own.

The control lives in the same run: the other three genome bytes, under the same
drift, the same population size, the same mutation.

```text
byte         role                              entropy (bits, max 8.0)
resilience   16..23  longevity, selected        6.657 ± 0.053
efficiency   0..7    metabolic burn, selected   7.042 ± 0.038
radiance     24..31  near-unused                7.227 ± 0.020
hand         8..15   predation, cyclic          7.355 ± 0.024

at ignition, all four                           7.81
```

Drift narrows everything — all four start at 7.81 and none stays there. What
matters is the ordering, and it is exactly the one the theory predicts: the two
bytes under directional selection are narrowed most, the near-unused byte sits
between, and **the hand is held wider than neutrality** — 0.128 ± 0.031 above
the unused control, about 4σ.

That is the signature of balancing selection proper. It does not merely fail to
narrow the trait; it actively resists narrowing more than no selection at all
does. The Era-973 claim survives, but the honest magnitude is a tenth of a bit
above neutral, not "7.30 of a possible 8.0".

Both corrections in this file came from the same omission — a number reported
without the thing that makes it mean something. First an estimator compared
against no null, then a mean compared against no error bar, now an entropy
compared against no neutral control.

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
