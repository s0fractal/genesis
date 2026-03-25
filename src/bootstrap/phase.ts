import { PhaseLatticeField, phase_lattice_shannon_entropy, phase_lattice_omega_span, phase_lattice_signature, phase_lattice_total_amplitude } from "@wasm";
import { PhasePerturbationInjector } from "../lens/phase_input.ts";
import { PhaseComputeEngine } from "../lens/phase_compute.ts";
import { SemanticCoupler } from "../ontology/semantic_layer.ts";
import { SovereignOracle } from "../ontology/oracle.ts";
import { PhaseWebGPUObserver } from "../lens/phase_webgpu.ts";
import { configureCanvas, wireSemanticInput, DOM, frames, setHudStat, setInputMode, tickFps, updateHomeostasisHUD } from "./dom.ts";
import { hydrateSubstrateHeader, KURAMOTO_COUPLING_BASE, MUTATION_BASE_COST } from "../shared/constants.ts";
import { downloadGenesisFile, exportGenesisState, parseGenesisState } from "../ontology/persistence.ts";
import { PhaseNetwork } from "../shared/phase_network.ts";
import { SenateChatHUD } from "../ontology/senate_hud.ts";
import { PhylogeneticCanvas } from "../ontology/phylogeny.ts";
import { TOPOS_DICTIONARY } from "../shared/topos_dictionary.ts";


export async function bootstrapPhase(wasmMemory: WebAssembly.Memory) {
  console.log("[Genesis] Bootstrapping flattened phase lattice (Era 229: OOP Decapitation)...");

  // Init Phase Objects
  const canvas = configureCanvas();
  const phaseField = new PhaseLatticeField(256, 256, 1);
  hydrateSubstrateHeader(wasmMemory, phaseField.ptr_header());
  
  let device: GPUDevice | null = null;
  
  // Era 243: CPU Hardware Fallback Boundary
  try {
      if (!navigator.gpu) throw new Error("WebGPU API missing");
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error("WebGPU adapter unavailable");
      device = await adapter.requestDevice();
  } catch (err) {
      console.error("🛑 [O-243 FATAL] WebGPU Initialization Failed! Engaging WASM CPU-Fallback Mode.", err);
      // Let device remain null, engines will detect IS_CPU_FALLBACK implicitly.
  }

  const computeEngine = new PhaseComputeEngine(device, phaseField, wasmMemory);
  const observer = new PhaseWebGPUObserver(canvas, phaseField, computeEngine, device);
  const oracle = new SovereignOracle(phaseField, wasmMemory, computeEngine, observer);

  // Init Systems
  await computeEngine.init();
  await observer.init();
  oracle.boot();

  DOM.hudTitle?.replaceChildren("Φ Phase Lattice");
  DOM.statusLabel?.replaceChildren("PHASE MODE ACTIVE");
  setHudStat("a", "SECTORS", "64x10x3");
  setHudStat("b", "FPS", "0");
  setHudStat("c", "SIGNATURE", "warming");
  setInputMode("semantic");

  let heatmapEnabled = false;
  globalThis.addEventListener("keydown", (e) => {
      if (e.key === "h" || e.key === "H") {
          heatmapEnabled = !heatmapEnabled;
          observer.heatmapEnabled = heatmapEnabled;
      }
  });

  let hoveredAgent: { hash: bigint; amp: number; lock: number; ent: number; } | null = null;
  globalThis.addEventListener('gridHover', (e: Event) => {
      hoveredAgent = (e as CustomEvent).detail;
  });

  const senateChat = new SenateChatHUD();
  const network = new PhaseNetwork((plasmid) => {
      const hash = BigInt(plasmid.hash);
      if (oracle.plasmidRegistry.has(hash)) {
          const node = oracle.plasmidRegistry.get(hash)!;
          node.attention += Math.max(10, Math.floor(plasmid.energy / 100)); 
          node.energy += Math.min(1000, plasmid.energy); 
          oracle.activePlasmids.add(hash); 
          return;
      }
      try {
          computeEngine.injectPlasmidIntoBucket(plasmid.targetBucket, hash);
      } catch (_e) { /* Ignored due to full-bucket race condition overrides */ }
  });

  oracle.bindNetwork((hash, targetBucket) => network.broadcastPlasmid(hash.toString(), targetBucket, 1500, 300));
  oracle.onSenateEvent = (event) => senateChat.handleEvent(event);
  oracle.onVision = (base64: string) => {
      const debugImg = document.getElementById("oracle-debug-vision") as HTMLImageElement;
      if (debugImg) {
          debugImg.style.display = "block";
          debugImg.src = "data:image/png;base64," + base64;
      }
  };

  const phylogenyHUD = new PhylogeneticCanvas();

  const injector = new PhasePerturbationInjector(canvas, phaseField, wasmMemory, computeEngine, oracle);
  injector.attach();
  const coupler = new SemanticCoupler(injector);
  wireSemanticInput(coupler, "Inject phase attractor...");

  DOM.btnSaveGenesis?.addEventListener("click", async () => {
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
    computeEngine.injectGridState(payload.grid);
    oracle.unpackState(payload.registry, payload.globalEnergy, payload.epochTicks, payload.event_ledger);
    target.value = "";
  });

  (globalThis as unknown as { injectMycelialTest: () => void }).injectMycelialTest = () => {
    const hash = 999999888888777n;
    const cellA_top = Math.floor(phaseField.cell_count() * 0.1);
    const cellB_bottom = Math.floor(phaseField.cell_count() * 0.9);
    computeEngine.injectPlasmid(cellA_top, hash);
    computeEngine.injectEnergy(cellA_top, 200);
    setTimeout(() => {
      computeEngine.injectPlasmid(cellB_bottom, hash);
      computeEngine.injectEnergy(cellB_bottom, 200);
    }, 100);
  };
  
  setTimeout(() => (globalThis as unknown as { injectMycelialTest: () => void }).injectMycelialTest(), 500);

  // Flat Game Loop 
  let lastShadowTelemetryCheck = performance.now();
  let lastPhylogenyCheck = performance.now();

  const loop = () => {
      const nowLocal = performance.now();

      // Thermodynamic Tick
      const entropy = phase_lattice_shannon_entropy(phaseField);
      oracle.tickHomeostasis(entropy);

      if (nowLocal - lastShadowTelemetryCheck > 1000) {
          lastShadowTelemetryCheck = nowLocal;
          const centroids = computeEngine.readMycelialCentroids();
          if (centroids) {
              let pressure = 0;
              for (let i = 1000; i < 1025; i++) pressure += centroids[i * 4 + 2];
              senateChat.updateShadowPressure(pressure);
          }
      }

      // WebGPU Tick
      if (!oracle.isBusy) computeEngine.tick();
      observer.render(computeEngine.getActiveBuffer());

      // Oracle/Network Tick
      oracle.sync();
      network.localRefractiveIndex = Math.max(0.1, oracle.lastEntropy);

      // UI Tick
      if (nowLocal - lastPhylogenyCheck > 1000) {
          lastPhylogenyCheck = nowLocal;
          phylogenyHUD.tick();
          
          // Era 234.3: The Voice of the Grid
          const apex = oracle.getApexPlasmids(3);
          const apexAudioArgs = apex.map(p => ({
              hash: p.hash.toString(),
              astStr: p.ast,
              energy: p.energy
          }));
          observer.choir.syncEcosystemVoices(apexAudioArgs);
      }

      observer.choir.modulateParams(
          oracle.getGlobalEnergy() / 100000.0,
          Math.max(0, 1.0 - (oracle.getQueueSize() / 20.0)),
          Math.max(0, 1.0 - (entropy / 6.0)),
          (nowLocal % 5000) / 5000.0
      );

      tickFps();
      if (frames === 0) {
          setHudStat("a", "AMPLITUDE", phase_lattice_total_amplitude(phaseField).toString());
          setHudStat("c", "SIGNATURE", phase_lattice_signature(phaseField).slice(0, 12));
          DOM.statusLabel?.replaceChildren(`[${oracle.getCurrentClimate()}] ENT ${entropy.toFixed(2)} | Ω ${phase_lattice_omega_span(phaseField)} | Q ${oracle.getQueueSize()}`);
          const toposData = oracle.getTopSectors().map(t => ({
              name: TOPOS_DICTIONARY[t.topId]?.name || "Unknown", heat: t.topHeat
          }));
          updateHomeostasisHUD(entropy, oracle.getGlobalEnergy(), KURAMOTO_COUPLING_BASE, MUTATION_BASE_COST, toposData, oracle.getApexPlasmids(3), oracle.getFluxTelemetry(3), hoveredAgent);
      }

      requestAnimationFrame(loop);
  };
  loop();
}
