import { exists } from "https://deno.land/std@0.224.0/fs/exists.ts";

async function main() {
    console.log("🔍 [VERIFY] Checking dist artifact lifecycle...");

    const museumPath = "dist/museum.html";
    const wasmPath = "dist/v2/omega_v2_core.wasm";
    const wasmHashPath = "dist/v2/omega_v2_core.wasm.sha256";

    if (!(await exists(museumPath))) {
        throw new Error(`❌ Missing artifact: ${museumPath}`);
    }
    if (!(await exists(wasmPath))) {
        throw new Error(`❌ Missing artifact: ${wasmPath}`);
    }

    // Compute WASM Hash
    const wasmBytes = await Deno.readFile(wasmPath);
    const hashBuffer = await crypto.subtle.digest("SHA-256", wasmBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    await Deno.writeTextFile(wasmHashPath, hashHex);

    console.log(`✅ [VERIFY] Artifacts present.`);
    console.log(`✅ [VERIFY] WASM SHA-256: ${hashHex}`);
}

if (import.meta.main) {
    main().catch(e => {
        console.error(e);
        Deno.exit(1);
    });
}
