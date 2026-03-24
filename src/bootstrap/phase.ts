import { PhaseLatticeField } from "@wasm";
import { PhasePerturbationInjector } from "../lens/phase_input.ts";
import { PhaseComputeEngine } from "../lens/phase_compute.ts";
import { SemanticCoupler } from "../ontology/semantic_layer.ts";
import { SovereignOracle } from "../ontology/oracle.ts";
import { PhaseWebGPUObserver } from "../lens/phase_webgpu.ts";
import { configureCanvas, wireSemanticInput, DOM } from "./dom.ts";
import { hydrateSubstrateHeader } from "../shared/constants.ts";
import { downloadGenesisFile, exportGenesisState, parseGenesisState } from "../ontology/persistence.ts";
import { SubstrateOrchestrator } from "./managers/orchestrator.ts";
import { GPUCoreSubsystem } from "./managers/GPUCoreSubsystem.ts";
import { OracleNetworkSubsystem } from "./managers/OracleNetworkSubsystem.ts";
import { ThermodynamicSubsystem } from "./managers/ThermodynamicSubsystem.ts";
import { UISubsystem } from "./managers/UISubsystem.ts";

export async function bootstrapPhase(wasmMemory: WebAssembly.Memory) {
  console.log("[Genesis] Bootstrapping experimental phase lattice mode (Era 195: Systemic Topos)...");

  const canvas = configureCanvas();
  const phaseField = new PhaseLatticeField(256, 256, 1);
  hydrateSubstrateHeader(wasmMemory, phaseField.ptr_header());
  
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("WebGPU adapter not found — check browser/hardware support");
  const device = await adapter.requestDevice();

  const computeEngine = new PhaseComputeEngine(device, phaseField, wasmMemory);
  const observer = new PhaseWebGPUObserver(canvas, phaseField, computeEngine, device);
  const oracle = new SovereignOracle(phaseField, wasmMemory, computeEngine, observer);

  // O-195 Formalized Systemic Orchestrator
  const orchestrator = new SubstrateOrchestrator();

  const gpuSys = new GPUCoreSubsystem(device, phaseField, computeEngine, observer, oracle);
  const oracleSys = new OracleNetworkSubsystem(oracle, computeEngine);
  const thermoSys = new ThermodynamicSubsystem(phaseField, computeEngine, oracle, oracleSys.senateChat);
  const uiSys = new UISubsystem(phaseField, oracle, observer);

  orchestrator.register(gpuSys);
  orchestrator.register(oracleSys);
  orchestrator.register(thermoSys);
  orchestrator.register(uiSys);

  await orchestrator.boot();

  const injector = new PhasePerturbationInjector(canvas, phaseField, wasmMemory, computeEngine, oracle);
  injector.attach();

  const coupler = new SemanticCoupler(injector);
  wireSemanticInput(coupler, "Inject phase attractor...");

  // O-59 Substrate Persistence Bindings
  DOM.btnSaveGenesis?.addEventListener("click", async () => {
    console.log("[GENESIS] Serializing Torus topology and AST registry...");
    const plasmidsBuffer = await computeEngine.extractPlasmidsBuffer();
    const headerBuffer = new Uint8Array(wasmMemory.buffer, phaseField.ptr_header(), 256).slice();
    const binary = exportGenesisState(oracle.getEpochTicks(), oracle.getGlobalEnergy(), plasmidsBuffer, phaseField.cell_count(), headerBuffer, oracle.eventLedger, oracle.plasmidRegistry);
    downloadGenesisFile(binary, Math.floor(oracle.getEpochTicks() / 1000));
  });

  DOM.btnLoadGenesis?.addEventListener("click", () => DOM.fileLoadGenesis?.click());

  DOM.fileLoadGenesis?.addEventListener("change", async (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    const buffer = await target.files[0].arrayBuffer();
    const payload = parseGenesisState(buffer);
    console.log(`[GENESIS] 🧬 Injecting Resurrected Substrate (Epoch Tick: ${payload.epochTicks})`);
    computeEngine.injectGridState(payload.grid);
    oracle.unpackState(payload.registry, payload.globalEnergy, payload.epochTicks, payload.event_ledger);
    target.value = "";
  });

  orchestrator.start();

  // O-24 Topos Debugger
  (globalThis as unknown as { injectMycelialTest: () => void }).injectMycelialTest = () => {
    const hash = 999999888888777n;
    const cellA_top = Math.floor(phaseField.cell_count() * 0.1);
    const cellB_bottom = Math.floor(phaseField.cell_count() * 0.9);
    console.log(`[MYCELIUM] Firing identical resonance flag into isolated nodes ${cellA_top} and ${cellB_bottom}`);
    computeEngine.injectPlasmid(cellA_top, hash);
    computeEngine.injectEnergy(cellA_top, 200);
    setTimeout(() => {
      computeEngine.injectPlasmid(cellB_bottom, hash);
      computeEngine.injectEnergy(cellB_bottom, 200);
    }, 100);
  };

  console.log("[Genesis] Phase lattice running. Use ?mode=phase to revisit this substrate.");
}
