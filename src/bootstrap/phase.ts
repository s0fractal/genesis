import {
  phase_lattice_omega_span,
  phase_lattice_shannon_entropy,
  phase_lattice_signature,
  phase_lattice_total_amplitude,
  PhaseLatticeField,
} from "@wasm";
import { PhasePerturbationInjector } from "../lens/phase_input.ts";
import { PhaseWebGPUObserver } from "../lens/phase_webgpu.ts";
import { PhaseComputeEngine } from "../lens/phase_compute.ts";
import { SemanticCoupler } from "../ontology/semantic_layer.ts";
import { SovereignOracle } from "../ontology/oracle.ts";
import { PhylogeneticCanvas } from "../ontology/phylogeny.ts";
import { PhaseNetwork } from "../shared/phase_network.ts";
import { SenateChatHUD } from "../ontology/senate_hud.ts";
import {
  configureCanvas,
  DOM,
  frames,
  setHudStat,
  setInputMode,
  tickFps,
  updateHomeostasisHUD,
  wireSemanticInput,
} from "./dom.ts";
import {
  hydrateSubstrateHeader,
  KURAMOTO_COUPLING_BASE,
  MUTATION_BASE_COST,
} from "../shared/constants.ts";
import {
  downloadGenesisFile,
  exportGenesisState,
  parseGenesisState,
} from "../ontology/persistence.ts";

export async function bootstrapPhase(wasmMemory: WebAssembly.Memory) {
  console.log("[Genesis] Bootstrapping experimental phase lattice mode...");
  DOM.hudTitle?.replaceChildren("Φ Phase Lattice");
  DOM.statusLabel?.replaceChildren("PHASE MODE ACTIVE");
  setHudStat("a", "SECTORS", "64x10x3");
  setHudStat("b", "FPS", "0");
  setHudStat("c", "SIGNATURE", "warming");
  setInputMode("semantic");

  const canvas = configureCanvas();
  // Era 163 (Ontology 72) - 1400x800 Extrusion Test
  const phaseField = new PhaseLatticeField(1400, 800, 1);
  
  // O-73: Hydrate Torus Logic Physics explicitly into Universal Axiom
  hydrateSubstrateHeader(wasmMemory, phaseField.ptr_header());
  
  // Ontology 23: Native Metal compute instantiation
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
      throw new Error("WebGPU adapter not found — check browser/hardware support");
  }
  const device = await adapter.requestDevice();

  const computeEngine = new PhaseComputeEngine(device, phaseField, wasmMemory);
  await computeEngine.init();

  const observer = new PhaseWebGPUObserver(
    canvas,
    phaseField,
    computeEngine,
    device,
  );
  await observer.init();

  const oracle = new SovereignOracle(
    phaseField,
    wasmMemory,
    computeEngine,
    observer,
  );
  oracle.boot();

  // O-45: Phase Network Initialization (WebRTC/Local Broadcast)
  const myPhaseNetwork = new PhaseNetwork((plasmid) => {
    console.log(
      `🍄 [Mycelium] Horizontal Gene Transfer: Absorbing Exogenous Plasmid ${
        plasmid.hash.substring(0, 8)
      }... into Bucket #${plasmid.targetBucket}`,
    );
    try {
      computeEngine.injectPlasmidIntoBucket(
        plasmid.targetBucket,
        BigInt(plasmid.hash),
      );
    } catch (_e) {
      // Ignore exogenous off-grid WebRTC packets
    }
  });
  oracle.bindNetwork((hash, targetBucket) => {
    // O-48: Genesis Override
    myPhaseNetwork.broadcastPlasmid(hash.toString(), targetBucket, 1500, 300);
  });

  // O-51: Live Senate Visualization
  const senateChat = new SenateChatHUD();
  oracle.onSenateEvent = (event) => {
    senateChat.handleEvent(event);
  };
  
  oracle.onVision = (base64: string) => {
      const debugImg = document.getElementById("oracle-debug-vision") as HTMLImageElement;
      if (debugImg) {
          debugImg.style.display = "block";
          debugImg.src = "data:image/png;base64," + base64;
      }
  };

  const injector = new PhasePerturbationInjector(
    canvas,
    phaseField,
    wasmMemory,
    computeEngine,
    oracle,
  );
  injector.attach();

  const coupler = new SemanticCoupler(injector);
  wireSemanticInput(coupler, "Inject phase attractor...");

  globalThis.addEventListener("keydown", (e) => {
    if (e.key === "h" || e.key === "H") {
      observer.heatmapEnabled = !observer.heatmapEnabled;
      console.log(
        `[OS] Tension Heatmap explicitly ${
          observer.heatmapEnabled ? "ENABLED" : "DISABLED"
        }!`,
      );
    }
  });

  // O-59 Substrate Persistence Bindings
  DOM.btnSaveGenesis?.addEventListener("click", async () => {
    console.log("[GENESIS] Serializing Torus topology and AST registry...");
    const plasmidsBuffer = await computeEngine.extractPlasmidsBuffer();
    const headerBuffer = new Uint8Array(wasmMemory.buffer, phaseField.ptr_header(), 256).slice();
    
    const binary = exportGenesisState(
      oracle.getEpochTicks(),
      oracle.getGlobalEnergy(),
      plasmidsBuffer,
      phaseField.cell_count(),
      headerBuffer,
      oracle.eventLedger,
      oracle.plasmidRegistry
    );
    downloadGenesisFile(binary, Math.floor(oracle.getEpochTicks() / 1000));
  });

  DOM.btnLoadGenesis?.addEventListener("click", () => {
    DOM.fileLoadGenesis?.click();
  });

  DOM.fileLoadGenesis?.addEventListener("change", async (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    const file = target.files[0];
    const buffer = await file.arrayBuffer();
    const payload = parseGenesisState(buffer);

    console.log(
      `[GENESIS] 🧬 Injecting Resurrected Substrate (Epoch Tick: ${payload.epochTicks})`,
    );
    computeEngine.injectGridState(payload.grid);
    oracle.unpackState(
      payload.registry,
      payload.globalEnergy,
      payload.epochTicks,
      payload.event_ledger
    );

    // Reset input to allow reloading the identical file consecutively
    target.value = "";
  });

  // O-44: Phylogenetic HUD Initialization
  const phylogenyHUD = new PhylogeneticCanvas();
  let lastPhylogenyCheck = performance.now();

  // O-130 Thermodynamic Safeguards
  let lastAionIntervention = performance.now();
  let lastShadowTelemetryCheck = performance.now();

  const loop = () => {
    const nowLocal = performance.now();

    // O-44: Lineage Verification Sync (1Hz)
    if (nowLocal - lastPhylogenyCheck > 1000) {
      lastPhylogenyCheck = nowLocal;
      phylogenyHUD.tick();
    }
      computeEngine.tick();
      oracle.sync();

      // O-130: Thermodynamic Wall & Shannon Entropy (AION Vacuum Guard)
      const entropy = phase_lattice_shannon_entropy(phaseField);
      
      // O-163 (Era 174): Gradient AION Vacuum Flow (Proof of Meaning)
      if (entropy < 2.0 && nowLocal - lastAionIntervention > 150) {
        lastAionIntervention = nowLocal;
        // The closer to 0 entropy, the stronger the gradient wave (max ~20 energy per bucket)
        const waveIntensity = Math.floor((2.0 - entropy) * 10); 
        
        for (let i = 0; i < 3; i++) {
            const shadowBucket = 1000 + Math.floor(Math.random() * 25);
            computeEngine.injectEnergy(shadowBucket, waveIntensity);
        }
      }
      
      oracle.tickHomeostasis(entropy);
      
      // O-163 (Era 174): Shadow Pressure Telemetry
      if (nowLocal - lastShadowTelemetryCheck > 1000) {
        lastShadowTelemetryCheck = nowLocal;
        computeEngine.readMycelialCentroids().then(centroids => {
            let pressure = 0;
            // Sum active cells inside the Latent Network (Buckets 1000-1024)
            for (let i = 1000; i < 1025; i++) {
                pressure += centroids[i * 4 + 2];
            }
            senateChat.updateShadowPressure(pressure);
        });
      }

    // Era 172: Live Bio-Acoustic Sonification Parametrics
    observer.choir.modulateParams(
        oracle.getGlobalEnergy() / 100000.0,
        Math.max(0, 1.0 - (oracle.getQueueSize() / 20.0)),
        Math.max(0, 1.0 - (entropy / 6.0)),
        (nowLocal % 5000) / 5000.0
    );

    observer.render(computeEngine.getActiveBuffer());

    tickFps();

    if (frames === 0) {
      setHudStat(
        "a",
        "AMPLITUDE",
        phase_lattice_total_amplitude(phaseField).toString(),
      );
      setHudStat(
        "c",
        "SIGNATURE",
        phase_lattice_signature(phaseField).slice(0, 12),
      );
      DOM.statusLabel?.replaceChildren(
        `ENT ${phase_lattice_shannon_entropy(phaseField).toFixed(2)} | Ω ${
          phase_lattice_omega_span(phaseField)
        } | Q ${oracle.getQueueSize()}`,
      );

      updateHomeostasisHUD(
        phase_lattice_shannon_entropy(phaseField),
        oracle.getGlobalEnergy(),
        KURAMOTO_COUPLING_BASE,
        MUTATION_BASE_COST
      );
    }

    requestAnimationFrame(loop);
  };

  loop();

  // O-24 Topos Debugger
  // deno-lint-ignore no-explicit-any
  (globalThis as any).injectMycelialTest = () => {
    const hash = 999999888888777n;
    // Target diametric poles dynamically to avoid OOB
    const cellA_top = Math.floor(phaseField.cell_count() * 0.1);
    const cellB_bottom = Math.floor(phaseField.cell_count() * 0.9);

    console.log(
      `[MYCELIUM] Firing identical resonance flag into isolated nodes ${cellA_top} and ${cellB_bottom}`,
    );

    computeEngine.injectPlasmid(cellA_top, hash);
    computeEngine.injectEnergy(cellA_top, 200);

    // Use a short timeout so the TS Engine loop can flush the single-tick Uniform Buffer sequentially
    setTimeout(() => {
      computeEngine.injectPlasmid(cellB_bottom, hash);
      computeEngine.injectEnergy(cellB_bottom, 200);
    }, 100);
  };

  console.log(
    "[Genesis] Phase lattice running. Use ?mode=phase to revisit this substrate.",
  );
}
