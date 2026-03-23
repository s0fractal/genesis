const text = await Deno.readTextFile("omega_core/src/phase_lattice.rs");

// Execute massive regex mapping from SoA to AoS layout across entire file
let updated = text
    .replace(/field\.theta\[(.*?)\]/g, "field.agents[$1].theta")
    .replace(/field\.omega\[(.*?)\]/g, "field.agents[$1].omega")
    .replace(/field\.amplitude\[(.*?)\]/g, "field.agents[$1].energy")
    .replace(/field\.lock\[(.*?)\]/g, "field.agents[$1].lock")
    .replace(/field\.entanglement\[(.*?)\]/g, "field.agents[$1].entanglement")
    .replace(/field\.plasmids\[(.*?)\]/g, "field.agents[$1].plasmid")
    // Left/Right testing blocks
    .replace(/left\.theta\[(.*?)\]/g, "left.agents[$1].theta")
    .replace(/left\.omega\[(.*?)\]/g, "left.agents[$1].omega")
    .replace(/left\.amplitude\[(.*?)\]/g, "left.agents[$1].energy")
    .replace(/left\.lock\[(.*?)\]/g, "left.agents[$1].lock")
    .replace(/left\.entanglement\[(.*?)\]/g, "left.agents[$1].entanglement")
    .replace(/left\.plasmids\[(.*?)\]/g, "left.agents[$1].plasmid")
    .replace(/right\.theta\[(.*?)\]/g, "right.agents[$1].theta")
    .replace(/right\.omega\[(.*?)\]/g, "right.agents[$1].omega")
    .replace(/right\.amplitude\[(.*?)\]/g, "right.agents[$1].energy")
    .replace(/right\.lock\[(.*?)\]/g, "right.agents[$1].lock")
    .replace(/right\.entanglement\[(.*?)\]/g, "right.agents[$1].entanglement")
    .replace(/right\.plasmids\[(.*?)\]/g, "right.agents[$1].plasmid")
    // Also "amp" iterators
    .replace(/field\.amplitude\.iter\(\)/g, "field.agents.iter().map(|a| a.energy)");

// Fix fossilization layer
updated = updated.replace(
    /field\.theta\.copy_within\(src_start\.\.src_end, dst_start\);\n\s*field\.omega\.copy_within\(src_start\.\.src_end, dst_start\);\n\s*field\.amplitude\.copy_within\(src_start\.\.src_end, dst_start\);\n\s*field\.lock\.copy_within\(src_start\.\.src_end, dst_start\);\n\s*field\.entanglement\.copy_within\(src_start\.\.src_end, dst_start\);\n\s*field\.plasmids\.copy_within\(src_start\.\.src_end, dst_start\);/,
    "field.agents.copy_within(src_start..src_end, dst_start);"
);

await Deno.writeTextFile("omega_core/src/phase_lattice.rs", updated);
console.log("Refactored PhaseLatticeField seamlessly!");
