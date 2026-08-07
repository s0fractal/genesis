# The law as it stands — Era 974

What this world is, now. Not how it got here: `PHYSICS_BOUNDARY.md` is the
journal — 1500 lines of era-by-era changes, measurements and retractions — and
after thirteen eras the current law had disappeared into it. A reader could
follow the argument and still not be able to say what the physics **is**.

Every magnitude below is measured, not asserted, and every one comes from the
knockout audit and the replication runs recorded in the journal. Where a number
is uncertain it says so.

---

## What the world is

Four thousand agents on a 64×64 torus. Each holds a phase, an energy, a natural
frequency, a 32-bit genome and three memory words — 32 bytes, mirrored
byte-for-byte by a WGSL shader and an SP1 guest, all three required to compute
the same thing.

Agents **do not move.** A slot is a place, and the only way anything changes
position is by being born somewhere else.

The world is **open**: photosynthesis pays in, dissipation and death pay out,
and the books close to the byte (`leaked: 0`, verified every run).

---

## The engine — three mechanisms carry the outcome

Measured by knockout, two seeds, everything else held: see the audit in the
journal for the full table.

### Senescence — the keystone

Maintenance rises with age until upkeep outruns what the sun pays, so agents die
of accumulated expense. Death stays an **energy** outcome, which is why the
conservation ledger needs no special case for it.

The rate is heritable, scaled by the `resilience` gene (bits 16..23), and it
**costs what it buys**: the same factor that slows ageing multiplies upkeep. A
maximally resilient agent pays five times the maintenance and ages five times
slower.

Remove it and the world reverts to a photograph: the lattice fills by tick 550,
then nothing is born and nothing dies, and every trait freezes. **Every other
result in this file depends on it** — including the food web's polymorphism,
which collapses to neutral without turnover.

### Conduction — what keeps the population up

Neighbours in phase pool their energy; neighbours out of phase do not. This is
58% of all energy transfer and the strongest single term in the model.

It also **suppresses crystallisation entirely** (see vestigial, below).

### The cyclic food web — what keeps diversity open

`species_advantage` is a ring of 256 hands on genome bits 8..15: `a` beats `b`
when it sits in the half-ring ahead. Rock-paper-scissors.

Whatever the population converges on, something beats it. The winner becomes the
majority and the majority becomes the target, so the trait is held **wider than
neutrality** — +0.272 ± 0.025 bits above a near-unused control byte, replicated
across four independent worlds at 5.4σ.

It moves 42% of all energy transfer and buys about 6% more turnover. Whether
that price is worth paying is an open design question with numbers attached.

---

## What is measured and small

Kept because it is correct, not because it does much. Naming these is the point:
a reader who sees "Kuramoto" in the repo name should know what it currently
amounts to.

**Phase is load-bearing — as an address, not as an oscillator.** This is the
distinction the project's name obscures, and it is measurable. Conduction is
gated on `cos(θ_n − θ_a)`: neighbours in phase pool energy, neighbours out of
phase do not. Remove the _gate_ while leaving conduction itself alone, two
seeds:

```text
                  gate on          gate off
alive            3770 ± 25        2244 ± 5
hand entropy    0.270 ± 0.041   0.115 ± 0.061
```

Forty percent of the population and half the polymorphism depend on phase
deciding **who shares with whom**. Nothing depends on phases synchronising —
which they never have, and which five separate attempts failed to make them do.

Phase is a compatibility coordinate. The oscillator machinery around it is what
is small:

**Kuramoto–Sakaguchi coupling.** Mean magnitude 0.105 phase units per tick
against a natural-frequency spread of ±32 — about 0.6% of what moves a phase.
Raising it does not help: only the current value converges a zero-spread
population, and everything above it destroys order rather than building it,
because the next representable step already overshoots. The Sakaguchi lag α is
π/2 exactly and sweeping it 0°–90° changes nothing measurable.

**Time dilation.** Knockout moves nothing outside the error bars.

**Global order.** 0.015. This world has never synchronised, and the 0.41
recorded in Era 962 was a measurement artifact of a phase circle half the width
of the sine table it was read through — fixed in Era 966.

---

## What is vestigial

**Tissue crystallisation.** Fraction **0.002**. The subsystem of Eras 963–970 —
relative threshold, reversibility, dedifferentiation — essentially never fires.

The cause is a constant, not a bug: crystallisation requires
`energy > max(local_mean, MAX_ATP/2)`, above 2048, in a world where mean energy
per agent is 690 and the single richest agent averages 2468. That floor was
added in Era 964 to guard the degenerate start, when agents sat near the cap.
Senescence made the world poorer and the absolute floor did not follow.

Every setting that raises the tissue fraction lowers both the population and the
polymorphism, so this is **not** a bug to fix by reflex. It is a decision.

---

## Space

**Latitude.** The y axis is insolation: row 0 the equator, row h/2 the pole,
which on a torus is one bright band and one dark. Same laws everywhere,
different light.

It produces a cline in resilience — richer band pays for longevity, poorer band
does not — but a shallow and noisy one: **5.13 ± 1.41** across four independent
worlds, against **16.8** for the same environmental range in isolated worlds.
Gene flow eats the rest.

**Dispersal.** A child takes a vacancy among its parent's eight neighbours when
there is one, and the first free slot anywhere when there is not — which at
capacity is **89% of the time**. Restricting that measurably makes things worse:
a free cell is both a dispersal destination and a reproductive opportunity, and
in this world they are the same resource.

---

## The four conservation laws

Every joule that leaves an agent lands somewhere nameable. Details and their
derivations are in the journal; the laws themselves:

1. **Death** is priced in bits — `set_bits × LANDAUER_BIT_COST`, not magnitudes.
2. **Reproduction** is closed: `parent_out == child_in + entropy`.
3. **Predation** takes `min(PREDATOR_ENERGY_STEAL, prey_energy / 8)`, the 8
   being the neighbourhood, so eight predators cannot remove more than the prey
   holds. Proved exhaustively over `0..=MAX_ATP`.
4. **Dissipation** is recovered at the substrate boundary — the difference
   between the state a substrate was handed and the state it returned, which is
   the one thing it cannot hide.

A rise is never booked. Energy appearing from nowhere is a defect, not negative
entropy, and absorbing it would make the ledger a tautology.

---

## How to read a number from this world

Four ways this repo has fooled itself, each caught after the fact, each now
answered by an instrument rather than by care:

- **A statistic without a null.** The local order parameter reported 0.12 on a
  field whose true value is zero, for five eras.
- **A mean without an error bar.** Tail means from one run are point estimates;
  consecutive samples are autocorrelated, so the naive standard error overstates
  confidence by about fourfold here.
- **An entropy without a neutral control.** "7.30 of a possible 8.0" means
  nothing until an unselected byte from the same run sits beside it.
- **Replicates that were not independent.** Both probes take a seed now. Blocks
  within one trajectory are not four worlds.

A number without its neighbour — a null, an error bar, a control, a replicate —
looks like a discovery right up until someone checks.

---

## Where the law lives

| What                                                                  | Where                                                |
| --------------------------------------------------------------------- | ---------------------------------------------------- |
| The physical operator                                                 | `omega_v2/src/lattice.rs::tick_physics`              |
| The food web                                                          | `omega_v2/src/agent.rs::species_advantage`           |
| Constants (edit here, not in `constants.rs` — that file is generated) | `src/ontology/genesis_ssot.ts`                       |
| The GPU mirror                                                        | `src/lens/shaders/compute_toroidal.wgsl`             |
| Declared law hash                                                     | `omega_v2/src/law_hash.rs` — `0x5F9B2ABC`            |
| Behavioural anchor (what a constant list cannot see)                  | `omega_v2/tests/behavioral_law_anchor.rs`            |
| Instruments                                                           | `tools/structure_probe.ts`, `tools/ecology_probe.ts` |
| The journal                                                           | `docs/PHYSICS_BOUNDARY.md`                           |
