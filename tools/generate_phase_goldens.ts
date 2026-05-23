import {
  buildPhaseBridgeGolden,
  buildPhaseCoherenceGolden,
  buildPhaseCrossGolden,
  initOmegaWasm,
  PHASE_BRIDGE_GOLDEN,
  PHASE_COHERENCE_GOLDEN,
  PHASE_CROSS_GOLDEN,
  writeGolden,
} from "./phase_golden_common.ts";

async function main(): Promise<void> {
  const wasm = await initOmegaWasm();

  const coherenceGolden = buildPhaseCoherenceGolden();
  const bridgeGolden = buildPhaseBridgeGolden();
  const crossGolden = buildPhaseCrossGolden(wasm);

  await writeGolden(PHASE_COHERENCE_GOLDEN, coherenceGolden);
  await writeGolden(PHASE_BRIDGE_GOLDEN, bridgeGolden);
  await writeGolden(PHASE_CROSS_GOLDEN, crossGolden);

  console.log("=== Genesis generate:phase-goldens ===");
  console.log(`phase_coherence_ticks=${coherenceGolden.ticks}`);
  console.log(`phase_bridge_ticks=${bridgeGolden.ticks}`);
  console.log(`phase_cross_ticks=${crossGolden.ticks}`);
  console.log(`phase_coherence_file=${PHASE_COHERENCE_GOLDEN.pathname}`);
  console.log(`phase_bridge_file=${PHASE_BRIDGE_GOLDEN.pathname}`);
  console.log(`phase_cross_file=${PHASE_CROSS_GOLDEN.pathname}`);
  console.log("status=PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
