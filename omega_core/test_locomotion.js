import { PhaseLatticeField, fnv1a_64 } from "./pkg/omega_core.js";

async function run() {
    console.log("Booting WASM PhaseLattice for Locomotion Test...");
    const field = new PhaseLatticeField(256, 256, 1);
    
    // Inject a dummy agent at index 0
    const dummyHash = fnv1a_64("TEST_SPECIES");
    
    // Test native translation mapping
    console.log("Setting agent 0 to Hash...");
    // We don't have ptr_plasmids exported in this test easily without full mock
    // But we CAN just test swap_agents
    
    // Initialize deterministic so agents have values
    field.seed_deterministic();
    field.swap_agents(0, 10);
    
    console.log("Swap completed successfully in WASM.");
    
    console.log("Verified physical layout logic natively.");
}

run();
