  phase_lattice_omega_span,
  phase_lattice_shannon_entropy,
  phase_lattice_signature,
  phase_lattice_total_amplitude,
  phase_lattice_total_entanglement,
  PhaseLatticeField,
} from "../../omega_core/pkg/omega_core.js";
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
  wireSemanticInput,
} from "./dom.ts";
import { TISSUE_CONSTANTS } from "../shared/constants.ts";

export async function bootstrapPhase(wasmMemory: WebAssembly.Memory) {
  console.log("[Genesis] Bootstrapping experimental phase lattice mode...");
  DOM.hudTitle?.replaceChildren("Φ Phase Lattice");
  DOM.statusLabel?.replaceChildren("PHASE MODE ACTIVE");
  setHudStat("a", "SECTORS", "64x10x3");
  setHudStat("b", "FPS", "0");
  setHudStat("c", "SIGNATURE", "warming");
  setInputMode("semantic");

  const canvas = configureCanvas();
  let phaseField = new PhaseLatticeField(64, 10, 3);
  // Ontology 23: Native Metal compute instantiation
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter!.requestDevice();

  let computeEngine = new PhaseComputeEngine(device, phaseField, wasmMemory);
  await computeEngine.init();

  let observer = new PhaseWebGPUObserver(
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
      console.log(`🍄 [Mycelium] Horizontal Gene Transfer: Absorbing Exogenous Plasmid ${plasmid.hash.substring(0,8)}... into Bucket #${plasmid.targetBucket}`);
      try {
          computeEngine.injectPlasmidIntoBucket(plasmid.targetBucket, BigInt(plasmid.hash));
      } catch(_e) {}
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
          console.log(`[OS] Tension Heatmap explicitly ${observer.heatmapEnabled ? "ENABLED" : "DISABLED"}!`);
      }
  });

  let lastShedCheck = performance.now();
  
  // O-44: Phylogenetic HUD Initialization
  const phylogenyHUD = new PhylogeneticCanvas();
  let lastPhylogenyCheck = performance.now();
  let isShedding = false; // O-57
  
  // O-65 Invariant Guards
  let initialWrapSectors = true; 
  let ticksSinceLastShedding = 0;
  
  // O-130 Thermodynamic Safeguards
  let lastAionIntervention = performance.now();

  const loop = async () => {
    ticksSinceLastShedding++;
    // O-32: Morphological Hot-Reloading Polling (Shedding Event)
    const nowLocal = performance.now();
    if (nowLocal - lastShedCheck > 1000 && !isShedding) {
        lastShedCheck = nowLocal;
        try {
            const res = await fetch("/I.md", { cache: "no-store" });
            if (res.ok) {
                const text = await res.text();
                const nodeIdx = text.indexOf("### tissue_constants");
                if (nodeIdx !== -1) {
                    const irIdx = text.indexOf("#### IR", nodeIdx);
                    if (irIdx !== -1) {
                        const codeStart = text.indexOf("```json\n", irIdx) + 8;
                        const codeEnd = text.indexOf("\n```", codeStart);
                        if (codeStart > 8 && codeEnd > codeStart) {
                            const body = JSON.parse(text.substring(codeStart, codeEnd));
                            let tSectors = phaseField.sectors;
                            let tRadial = phaseField.radial_bins;
                            let tHarm = phaseField.harmonics;
                
                if (body.SECTORS !== undefined) tSectors = body.SECTORS;
                if (body.RADIAL_BINS !== undefined) tRadial = body.RADIAL_BINS;
                if (body.HARMONICS !== undefined) tHarm = body.HARMONICS;
                
                // O-50 Phase 2: Dimensional Parameter Clamp (VRAM Quota)
                if (tSectors > 256) tSectors = 256;
                if (tRadial > 256) tRadial = 256;
                if (tHarm > 16) tHarm = 16;
                // Minimum topology checks
                if (tSectors < 8) tSectors = 8;
                if (tRadial < 8) tRadial = 8;

                // O-65: Prevent Genus Tear
                if (body.WRAP_SECTORS !== undefined && body.WRAP_SECTORS !== initialWrapSectors) {
                     console.warn(`[O-65] Topological Invariant Violation. Cannot alter Genus geometry mid-simulation.`);
                }
                
                // O-65: Morphological Hysteresis & Delta
                const isMorphing = tSectors !== phaseField.sectors || tRadial !== phaseField.radial_bins || tHarm !== phaseField.harmonics;
                if (isMorphing) {
                    if (ticksSinceLastShedding < TISSUE_CONSTANTS.MORPHOLOGICAL_HYSTERESIS) {
                        console.warn(`[O-65] Morphological Hysteresis active (${ticksSinceLastShedding}/${TISSUE_CONSTANTS.MORPHOLOGICAL_HYSTERESIS}). Rejecting mutation.`);
                        tSectors = phaseField.sectors;
                        tRadial = phaseField.radial_bins;
                        tHarm = phaseField.harmonics;
                    } else {
                        const oldVolume = phaseField.sectors * phaseField.radial_bins * phaseField.harmonics;
                        const newVolume = tSectors * tRadial * tHarm;
                        const delta = Math.abs(newVolume - oldVolume) / oldVolume;
                        if (delta < TISSUE_CONSTANTS.MORPHOLOGICAL_DELTA_MIN) {
                            console.warn(`[O-65] Morphological Delta ${delta.toFixed(2)} < ${TISSUE_CONSTANTS.MORPHOLOGICAL_DELTA_MIN}. Rejecting.`);
                            tSectors = phaseField.sectors;
                            tRadial = phaseField.radial_bins;
                            tHarm = phaseField.harmonics;
                        }
                    }
                }

                    if (tSectors !== phaseField.sectors || tRadial !== phaseField.radial_bins || tHarm !== phaseField.harmonics) {
                        ticksSinceLastShedding = 0;
                        initialWrapSectors = body.WRAP_SECTORS ?? initialWrapSectors;
                        
                        console.log(`\n🦋 UNIVERSAL SHEDDING EVENT DETECTED -> Biomass mutated geometry to ${tSectors}x${tRadial}x${tHarm}`);
                        console.log(`🧨 Securing VRAM Pointers for Asynchronous Morphological Migration...`);
                        
                        isShedding = true;
                        DOM.statusLabel?.replaceChildren(`SHEDDING IN PROGRESS (${tSectors}x${tRadial}x${tHarm})...`);
                        
                        // O-57: Asynchronous Morphological Interpolation (Nearest-Neighbor WebWorker)
                        const oldSectors = phaseField.sectors;
                        const oldRadial = phaseField.radial_bins;
                        const oldHarm = phaseField.harmonics;
                        
                        // Backup old tensors by safely duplicating via slice() before free
                        const _OCount = phaseField.cell_count();
                        const oldTheta = new Uint8Array(wasmMemory.buffer, phaseField.ptr_theta(), _OCount).slice();
                        const oldOmega = new Int16Array(wasmMemory.buffer, phaseField.ptr_omega(), _OCount).slice();
                        const oldPlasmids = new BigUint64Array(wasmMemory.buffer, phaseField.ptr_plasmids(), _OCount).slice();

                        const worker = new Worker(new URL("../workers/shedding_worker.ts", import.meta.url), { type: "module" });
                        
                        worker.postMessage({
                            oldTheta, oldOmega, oldPlasmids,
                            oldSectors, oldRadial, oldHarm,
                            tSectors, tRadial, tHarm
                        }, [oldTheta.buffer, oldOmega.buffer, oldPlasmids.buffer]);

                        worker.onmessage = async (e) => {
                            const { newTheta, newOmega, newPlasmids } = e.data;
                            
                            phaseField.resize_topology(tSectors, tRadial, tHarm);
                            
                            const ptrTheta = new Uint8Array(wasmMemory.buffer, phaseField.ptr_theta(), phaseField.cell_count());
                            const ptrOmega = new Int16Array(wasmMemory.buffer, phaseField.ptr_omega(), phaseField.cell_count());
                            const ptrPlasmids = new BigUint64Array(wasmMemory.buffer, phaseField.ptr_plasmids(), phaseField.cell_count());
                            
                            ptrTheta.set(newTheta);
                            ptrOmega.set(newOmega);
                            ptrPlasmids.set(newPlasmids);
                            
                            console.log(`✨ Topological interpolation fully migrated across WASM geometries via WebWorker.`);

                            computeEngine = new PhaseComputeEngine(device, phaseField, wasmMemory);
                            await computeEngine.init();

                            observer = new PhaseWebGPUObserver(canvas, phaseField, computeEngine, device);
                            await observer.init();

                            // Rebind global daemon observers identically
                            oracle.rebind(phaseField, computeEngine, observer);
                            injector.rebind(phaseField, computeEngine);
                            
                            setHudStat("a", "SECTORS", `${tSectors}x${tRadial}x${tHarm}`);
                            DOM.statusLabel?.replaceChildren("PHASE MODE ACTIVE");
                            console.log(`✨ Shedding Event Complete. System dimensions hot-reloaded seamlessly.\n`);
                            
                            isShedding = false;
                            worker.terminate();
                        };
                    }
                        }
                    }
                }
            }
        } catch(_e) {}
    }

    // O-44: Lineage Verification Sync (1Hz)
    if (nowLocal - lastPhylogenyCheck > 1000) {
        lastPhylogenyCheck = nowLocal;
        phylogenyHUD.tick();
    }

    if (!isShedding) {
        computeEngine.tick();
        oracle.sync();

        // O-130: Thermodynamic Wall & Shannon Entropy (AION Vacuum Guard)
        const entropy = phase_lattice_shannon_entropy(phaseField);
        if (entropy < 1.5 && nowLocal - lastAionIntervention > 1500) { 
           lastAionIntervention = nowLocal;
           // Inject Latent Entropy (Shadow Buckets 1000-1024)
           const shadowBucket = 1000 + Math.floor(Math.random() * 24);
           console.log(`[O-130] 🌑 AION ALARM: Thermodynamic Crystallization (Entropy ${entropy.toFixed(2)}). Injecting Latent Entropy into Bucket #${shadowBucket}`);
           injector.injectSemanticPhase(shadowBucket, Math.floor(Math.random() * 256), 255);
        }

        observer.render(computeEngine.getActiveBuffer());
    }

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
