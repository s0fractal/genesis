/**
 * OMEGA-64 Era 950: V2 Build Pipeline
 * Compiles the `omega_v2` no_std crate into a bare-metal WASM binary
 * and automatically optimizes it, bypassing wasm-pack and heavy JS bindings.
 */

async function main() {
  console.log("🚀 [OMEGA-V2] Building Bare-Metal Substrate...");

  const build = new Deno.Command("cargo", {
    args: [
      "build",
      "-p",
      "omega_v2",
      "--target",
      "wasm32-unknown-unknown",
      "--release",
    ],
    stdout: "inherit",
    stderr: "inherit",
  });

  const { success } = await build.output();

  if (!success) {
    console.error("❌ Failed to compile omega_v2");
    Deno.exit(1);
  }

  // Define paths
  const wasmSource = "./target/wasm32-unknown-unknown/release/omega_v2.wasm";
  const wasmDestDir = "./public/v2";
  const wasmDest = `${wasmDestDir}/omega_v2_core.wasm`;
  const wasmHashPath = `${wasmDestDir}/omega_v2_core.wasm.sha256`;

  await Deno.mkdir(wasmDestDir, { recursive: true });

  // Move the binary to the distribution folder
  await Deno.copyFile(wasmSource, wasmDest);

  // Compute WASM Hash
  const wasmBytes = await Deno.readFile(wasmDest);
  const hashBuffer = await crypto.subtle.digest("SHA-256", wasmBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  await Deno.writeTextFile(wasmHashPath, hashHex);

  const fileInfo = await Deno.stat(wasmDest);
  console.log(
    `✅ [OMEGA-V2] Build Success! Size: ${
      (fileInfo.size / 1024).toFixed(2)
    } KB -> ${wasmDest}`,
  );

  // Future AOT capabilities would go here (e.g. stripping, binding generation)
}

if (import.meta.main) {
  main();
}
