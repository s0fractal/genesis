/**
 * OMEGA-64 | Dimensional Analysis & Physical Homeostasis
 * 
 * Era 247: Dimensional Safety Matrix.
 * Enforces strict scientific types for thermodynamic properties.
 * Implicit scalar conversions are considered fatal architectural flaws.
 */

export type Joules = number & { readonly __brand: "Joules" };
export type Bits = number & { readonly __brand: "Bits" };
export type Hertz = number & { readonly __brand: "Hertz" };
export type Generation = number & { readonly __brand: "Generation" };
export type Celsius = number & { readonly __brand: "Celsius" };

// Thermodynamic baseline scalar metrics
export const ATP_PER_ENERGY_UNIT = 100 as Joules;
export const BITS_PER_ENTROPY_Q10 = (1.0 / 1024.0) as Bits;

/**
 * calculateFreeEnergy (Helmholtz Free Energy Equation Proxy: F = U - TS)
 * 
 * Determines whether a given topological cluster has sufficient spare capacity
 * to perform biological work (AST recursion) or if it has succumbed to 
 * thermodynamic heat death.
 */
export function calculateFreeEnergy(
    totalAmplitudeEnergy: number, 
    entropyQ10: number, 
    sectorHeat: number
): Joules {
    const internalEnergy = (totalAmplitudeEnergy * ATP_PER_ENERGY_UNIT) as Joules;
    
    // Convert mathematical Sector Heat (0.0 to 10.0) into thermodynamic Kelvin-equivalent stress
    const T = (sectorHeat * 25.0) as Celsius;
    const entropyBits = (entropyQ10 * BITS_PER_ENTROPY_Q10) as Bits;
    
    // Entropic drag: Work cost scales linearly with localized temperature
    const thermalEnergy = (entropyBits * T) as Joules;
    
    return (internalEnergy - thermalEnergy) as Joules;
}

/**
 * Type-safe wrappers for casting engine scalars into Physical Dimensions
 */
export function asJoules(value: number): Joules { return value as Joules; }
export function asBits(value: number): Bits { return value as Bits; }
export function asHertz(value: number): Hertz { return value as Hertz; }
export function asCelsius(value: number): Celsius { return value as Celsius; }
