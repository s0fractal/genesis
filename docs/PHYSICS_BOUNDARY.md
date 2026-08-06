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

### Not conserved yet — known, named, open

Listing these is the point. A conservation section that implied closure it does
not have would be the same failure as the tautological audit above.

1. **The `MAX_ATP` clamp discards surplus.** Energy delivered to an agent
   already at capacity is destroyed and booked nowhere. Closing it means either
   booking the surplus as entropy — which the shader cannot do, since `signals`
   is bound `var<uniform>` there and read-only — or refusing the transfer at
   source, i.e. a sated predator does not feed. The second is implementable on
   both substrates and is the likelier answer.
2. **Metabolic burn is an unbooked sink.** Every tick each agent loses `burn`
   ATP to maintenance, and it leaves the universe rather than entering the
   entropy trace. Physically it is dissipation and belongs there; the obstacle
   is the same read-only `signals` binding.
3. **Tail agents are one-way taps.** `h = max(1, active / w)` floors, so when
   `active` is not a multiple of `w` the agents in `[h*w, active)` read eight
   neighbours and are the neighbour of nobody. They exchange energy with
   counterparties who never reciprocate. Both substrates implement this
   identically — it is a topology defect, not a parity defect, and the torus is
   simply not closed for those indices. A parity config with `n=20` pins the
   agreement; nothing yet pins the conservation.
4. **`total_entropy_released` has no consumer.** It accumulates and is read for
   telemetry and time dilation, but nothing draws ATP back out of it. Until
   something does, omega is thermodynamically a decaying box rather than a cycle
   — every joule eventually reaches the trace and stops. The units are now
   bounded, so building the return path is possible; it has not been built, and
   inventing it is a decision about what the world is, not a repair.
