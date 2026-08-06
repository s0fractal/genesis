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
