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

### Not conserved yet — known, named, open

Listing these is the point. A conservation section that implied closure it does
not have would be the same failure as the tautological audit above.

1. **Tail agents are one-way taps.** `h = max(1, active / w)` floors, so when
   `active` is not a multiple of `w` the agents in `[h*w, active)` read eight
   neighbours and are the neighbour of nobody. They exchange energy with
   counterparties who never reciprocate — and because the reaper refuses to book
   a rise, the ATP they conjure does not even appear in the ledger as a
   negative. Both substrates implement this identically, so it is a topology
   defect, not a parity defect: the torus is simply not closed for those
   indices. A parity config with `n=20` pins the agreement; nothing yet pins the
   conservation.
2. **Dissipation is aggregate, not attributed.** The boundary ledger records
   that a joule was spent, not on what. Burn, clamp loss and any future leak
   arrive indistinguishable. That is the correct quantity for a thermodynamic
   trace and the wrong one for diagnosing a regression, so a leak introduced
   tomorrow would be absorbed silently into a number that has a legitimate
   reason to grow.
3. **`total_entropy_released` still has no consumer.** It accumulates and is
   read for telemetry and time dilation, but nothing draws ATP back out of it.
   Until something does, omega is thermodynamically a decaying box rather than a
   cycle — every joule eventually reaches the trace and stops. The units are
   bounded now and the trace is finally true, so the return path is buildable;
   it has not been built, and inventing it is a decision about what the world
   is, not a repair.
4. **Proper time is still the host's `+1`.** The kernel law
   (`1024 / (1 + stress/32)`) never runs on the substrate that does, so time
   dilation — stressed regions ageing more slowly — is a documented mechanic
   with no execution. Applying the kernel law verbatim would cycle `day_phase`
   once per tick, which is why the host's counter exists; the two paths carry
   genuinely different unit assumptions, and reconciling them changes how the
   world looks, not just what it accounts for.
