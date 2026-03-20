import initWasm, {
  execute_phase_bridge_tick,
  execute_simd_tick,
  Field,
  field_omega_span,
  field_signature,
  field_total_energy,
  field_total_locks,
  field_total_plasmids,
  phase_lattice_omega_span,
  phase_lattice_signature,
  phase_lattice_total_amplitude,
  phase_lattice_total_entanglement,
  PhaseLatticeField,
} from "../omega_core/pkg/omega_core.js";
import { LensObserver } from "./lens/init.ts";
import { PerturbationInjector } from "./lens/input.ts";
import { PhasePerturbationInjector } from "./lens/phase_input.ts";
import { PhaseReplayObserver } from "./lens/phase_replay_view.ts";
import { PhaseWebGPUObserver } from "./lens/phase_webgpu.ts";
import { PhaseComputeEngine } from "./lens/phase_compute.ts";
import { SemanticCoupler } from "./ontology/semantic_layer.ts";
import { SovereignOracle } from "./ontology/oracle.ts";
import { PhylogeneticCanvas } from "./ontology/phylogeny.ts";
import { PhaseNetwork } from "./shared/phase_network.ts";

const START_MS = performance.now();
import {
  buildDiffSummary,
  getReplayComparison,
  getReplaySnapshot,
  loadPhaseReplayDataset,
  summarizeReplayDiff,
} from "./replay/phase_replay.ts";
import {
  collapsePhaseField,
  cropPhaseField,
  hybridSnapshotSignature,
  loadHybridReplayDataset,
} from "./replay/hybrid_replay.ts";
import type { ReplayCompareMode } from "./replay/phase_replay.ts";
import type { PhaseField } from "./shared/phase_lattice.ts";

let lastTime = performance.now();
let frames = 0;
const hudTitle = document.getElementById("hud-title") as HTMLDivElement | null;
const statusLabel = document.getElementById("status-label") as
  | HTMLSpanElement
  | null;
const statALabel = document.getElementById("stat-a-label") as
  | HTMLSpanElement
  | null;
const statAValue = document.getElementById("stat-a-value") as
  | HTMLSpanElement
  | null;
const statBLabel = document.getElementById("stat-b-label") as
  | HTMLSpanElement
  | null;
const statBValue = document.getElementById("stat-b-value") as
  | HTMLSpanElement
  | null;
const statCLabel = document.getElementById("stat-c-label") as
  | HTMLSpanElement
  | null;
const statCValue = document.getElementById("stat-c-value") as
  | HTMLSpanElement
  | null;
const semanticInputGroup = document.getElementById("semantic-input-group") as
  | HTMLDivElement
  | null;
const replayControls = document.getElementById("replay-controls") as
  | HTMLDivElement
  | null;
const replayPlayButton = document.getElementById("replay-play") as
  | HTMLButtonElement
  | null;
const replayTickSlider = document.getElementById("replay-tick") as
  | HTMLInputElement
  | null;
const replayTickValue = document.getElementById("replay-tick-value") as
  | HTMLSpanElement
  | null;
const replayCompareSelect = document.getElementById("replay-compare") as
  | HTMLSelectElement
  | null;
const mode = new URLSearchParams(globalThis.location.search).get("mode") ||
  "classic";
const replayStack =
  new URLSearchParams(globalThis.location.search).get("stack") || "phase";

function configureCanvas() {
  const canvas = document.getElementById("lens-canvas") as HTMLCanvasElement;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  return canvas;
}

function wireSemanticInput(coupler: SemanticCoupler, placeholder: string) {
  const input = document.getElementById("semantic-input") as HTMLInputElement;
  const button = document.getElementById(
    "semantic-submit",
  ) as HTMLButtonElement;
  input.placeholder = placeholder;

  const dispatchIntent = () => {
    const val = input.value.trim();
    if (val) {
      coupler.projectIntent(val);
      input.value = "";
    }
  };

  button.addEventListener("click", dispatchIntent);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") dispatchIntent();
  });
}

function tickFps() {
  frames++;
  const now = performance.now();
  if (now - lastTime > 1000) {
    statBValue?.replaceChildren(frames.toString());
    frames = 0;
    lastTime = now;
  }
}

function setHudStat(
  slot: "a" | "b" | "c",
  label: string,
  value: string,
) {
  if (slot === "a") {
    statALabel?.replaceChildren(label);
    statAValue?.replaceChildren(value);
    return;
  }
  if (slot === "b") {
    statBLabel?.replaceChildren(label);
    statBValue?.replaceChildren(value);
    return;
  }
  statCLabel?.replaceChildren(label);
  statCValue?.replaceChildren(value);
}

function setInputMode(target: "semantic" | "replay") {
  semanticInputGroup?.toggleAttribute("hidden", target !== "semantic");
  replayControls?.toggleAttribute("hidden", target !== "replay");
}

async function bootstrapPhase(wasmMemory: WebAssembly.Memory) {
  console.log("[Genesis] Bootstrapping experimental phase lattice mode...");
  hudTitle?.replaceChildren("Φ Phase Lattice");
  statusLabel?.replaceChildren("PHASE MODE ACTIVE");
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
  const network = new PhaseNetwork((plasmid) => {
      console.log(`🍄 [Mycelium] Horizontal Gene Transfer: Absorbing Exogenous Plasmid ${plasmid.hash.substring(0,8)}... into Bucket #${plasmid.targetBucket}`);
      try {
          computeEngine.injectPlasmidIntoBucket(plasmid.targetBucket, BigInt(plasmid.hash));
      } catch(e) {}
  });

  oracle.bindNetwork((hash, targetBucket) => {
      network.broadcastPlasmid(hash.toString(), targetBucket);
  });

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

  const loop = async () => {
    // O-32: Morphological Hot-Reloading Polling (Shedding Event)
    const nowLocal = performance.now();
    if (nowLocal - lastShedCheck > 1000) {
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

                if (tSectors !== phaseField.sectors || tRadial !== phaseField.radial_bins || tHarm !== phaseField.harmonics) {
                    console.log(`\n🦋 UNIVERSAL SHEDDING EVENT DETECTED -> Biomass mutated geometry to ${tSectors}x${tRadial}x${tHarm}`);
                    console.log(`🧨 Securing VRAM Pointers for Morphological Migration...`);
                    
                    // O-37 Phase 1: Morphological Interpolation (Nearest-Neighbor)
                    const oldSectors = phaseField.sectors;
                    const oldRadial = phaseField.radial_bins;
                    const oldHarm = phaseField.harmonics;
                    
                    // Backup old tensors by safely duplicating via slice() before free
                    const _OCount = phaseField.cell_count();
                    const oldTheta = new Uint8Array(wasmMemory.buffer, phaseField.ptr_theta(), _OCount).slice();
                    const oldOmega = new Int16Array(wasmMemory.buffer, phaseField.ptr_omega(), _OCount).slice();
                    const oldPlasmids = new BigUint64Array(wasmMemory.buffer, phaseField.ptr_plasmids(), _OCount).slice();

                    phaseField.free();
                    phaseField = new PhaseLatticeField(tSectors, tRadial, tHarm);
                    
                    // Restore data mapped visually to the new topological dimensional sizes
                    const newTheta = new Uint8Array(wasmMemory.buffer, phaseField.ptr_theta(), phaseField.cell_count());
                    const newOmega = new Int16Array(wasmMemory.buffer, phaseField.ptr_omega(), phaseField.cell_count());
                    const newPlasmids = new BigUint64Array(wasmMemory.buffer, phaseField.ptr_plasmids(), phaseField.cell_count());

                    for (let h = 0; h < tHarm; h++) {
                        const oldH = Math.min(h, oldHarm - 1);
                        for (let r = 0; r < tRadial; r++) {
                            const ratioR = r / tRadial;
                            const oldR = Math.min(Math.floor(ratioR * oldRadial), oldRadial - 1);
                            for (let s = 0; s < tSectors; s++) {
                                const ratioS = s / tSectors;
                                const oldS = Math.min(Math.floor(ratioS * oldSectors), oldSectors - 1);
                                
                                const oldIdx = oldH * oldRadial * oldSectors + oldR * oldSectors + oldS;
                                const newIdx = h * tRadial * tSectors + r * tSectors + s;
                                
                                newTheta[newIdx] = oldTheta[oldIdx];
                                newOmega[newIdx] = oldOmega[oldIdx];
                                newPlasmids[newIdx] = oldPlasmids[oldIdx];
                            }
                        }
                    }
                    console.log(`✨ Topological interpolation fully migrated across WASM geometries.`);

                    computeEngine = new PhaseComputeEngine(device, phaseField, wasmMemory);
                    await computeEngine.init();

                    observer = new PhaseWebGPUObserver(canvas, phaseField, computeEngine, device);
                    await observer.init();

                    // Rebind global daemon observers identically
                    oracle.rebind(phaseField, computeEngine, observer);
                    injector.rebind(phaseField, computeEngine);
                    
                    setHudStat("a", "SECTORS", `${tSectors}x${tRadial}x${tHarm}`);
                    console.log(`✨ Shedding Event Complete. System dimensions hot-reloaded seamlessly.\n`);
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

    computeEngine.tick();
    oracle.sync();

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
      statusLabel?.replaceChildren(
        `ENT ${phase_lattice_total_entanglement(phaseField)} | Ω ${
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

async function bootstrapReplay() {
  console.log(
    `[Genesis] Bootstrapping replay diff mode for stack=${replayStack}...`,
  );
  hudTitle?.replaceChildren(
    replayStack === "cross"
      ? "Φ Cross Diff"
      : replayStack === "hybrid"
      ? "Φ Hybrid Replay"
      : "Φ Replay Diff",
  );
  statusLabel?.replaceChildren("LOADING CANONICAL TRACE");
  setHudStat("a", "TICK", "0/0");
  setHudStat("b", "FPS", "0");
  setHudStat(
    "c",
    replayStack === "phase"
      ? "PARITY"
      : replayStack === "hybrid"
      ? "TRACE"
      : "MODE",
    "loading",
  );
  setInputMode("replay");

  const canvas = configureCanvas();
  const observer = new PhaseReplayObserver(canvas);
  observer.init();

  const phaseDataset = await loadPhaseReplayDataset();
  const wasm = replayStack === "phase" ? null : await initWasm();
  // deno-lint-ignore no-explicit-any
  const hybridDataset = wasm
    ? await loadHybridReplayDataset(wasm as any)
    : null;
  let currentTick = 0;
  let compareMode: ReplayCompareMode = "seed";
  let playing = false;
  let lastAdvance = performance.now();
  const commonTicks = hybridDataset
    ? Math.min(phaseDataset.golden.ticks, hybridDataset.golden.ticks)
    : phaseDataset.golden.ticks;
  const totalTicks = replayStack === "hybrid" && hybridDataset
    ? hybridDataset.golden.ticks
    : replayStack === "cross"
    ? commonTicks
    : phaseDataset.golden.ticks;

  if (replayTickSlider) {
    replayTickSlider.min = "0";
    replayTickSlider.max = totalTicks.toString();
    replayTickSlider.step = "1";
    replayTickSlider.value = "0";
  }
  replayTickValue?.replaceChildren(`0/${totalTicks}`);
  if (replayCompareSelect) {
    replayCompareSelect.value = compareMode;
    replayCompareSelect.disabled = replayStack === "cross";
  }

  const render = () => {
    const boundedTick = Math.max(0, Math.min(totalTicks, currentTick));
    let current: PhaseField;
    let compare: PhaseField | null;
    let title: string;
    let statusLine: string;
    let leftLabel: string;
    let rightLabel: string;
    let summary;

    if (replayStack === "hybrid" && hybridDataset) {
      current = hybridDataset.snapshots[boundedTick];
      compare = getSnapshotComparison(
        hybridDataset.snapshots,
        boundedTick,
        compareMode,
      );
      const hybridTrace = hybridDataset.golden.wasmTrace[boundedTick];
      summary = buildDiffSummary(
        current,
        compare,
        hybridSnapshotSignature(current),
        hybridTrace.signature,
        false,
      );
      title = "hybrid replay";
      statusLine = `compare ${compareMode} | trace ${
        hybridTrace.signature.slice(0, 8)
      } | Ω ${hybridTrace.omegaSpan}`;
      leftLabel = "view";
      rightLabel = "golden";
      setHudStat("c", "TRACE", hybridTrace.signature.slice(0, 12));
      statusLabel?.replaceChildren(
        `HYBRID Δ${summary.changedCells} | RAW ${
          hybridTrace.signature.slice(0, 8)
        } | Ω ${hybridTrace.omegaSpan}`,
      );
    } else if (replayStack === "cross" && hybridDataset) {
      current = collapsePhaseField(
        getReplaySnapshot(phaseDataset, boundedTick),
        6,
      );
      compare = cropPhaseField(
        hybridDataset.snapshots[boundedTick],
        current.shape.radialBins,
      );
      summary = buildDiffSummary(
        current,
        compare,
        hybridSnapshotSignature(current),
        hybridSnapshotSignature(compare),
        false,
      );
      title = "phase vs hybrid";
      statusLine =
        "cross diff | phase collapsed to 1 harmonic | hybrid cropped to 6 rings";
      leftLabel = "phase";
      rightLabel = "hybrid";
      setHudStat("c", "MODE", "PH↔HY");
      statusLabel?.replaceChildren(
        `CROSS Δ${summary.changedCells} | PH ${
          summary.referenceStructuralSignature.slice(0, 8)
        } | HY ${summary.wasmStructuralSignature.slice(0, 8)}`,
      );
    } else {
      current = getReplaySnapshot(phaseDataset, boundedTick);
      compare = getReplayComparison(phaseDataset, boundedTick, compareMode);
      summary = summarizeReplayDiff(phaseDataset, boundedTick, compareMode);
      const referenceTrace = phaseDataset.golden.referenceTrace[boundedTick];
      const wasmTrace = phaseDataset.golden.wasmTrace[boundedTick];
      title = "phase replay";
      statusLine = `compare ${compareMode} | parity ${
        summary.parityLocked ? "locked" : "drift"
      }`;
      leftLabel = "ref";
      rightLabel = "wasm";
      setHudStat("c", "PARITY", summary.parityLocked ? "LOCKED" : "DRIFT");
      statusLabel?.replaceChildren(
        `${compareMode.toUpperCase()} Δ${summary.changedCells} | REF ${
          referenceTrace.structuralSignature.slice(0, 8)
        } | WASM ${wasmTrace.structuralSignature.slice(0, 8)}`,
      );
    }

    observer.render(current, compare, {
      tick: boundedTick,
      totalTicks,
      compareMode: replayStack === "cross" ? "none" : compareMode,
      summary,
      title,
      statusLine,
      leftLabel,
      rightLabel,
    });

    setHudStat("a", "TICK", `${boundedTick}/${totalTicks}`);
    replayTickValue?.replaceChildren(`${boundedTick}/${totalTicks}`);
  };

  replayPlayButton?.addEventListener("click", () => {
    playing = !playing;
    replayPlayButton.replaceChildren(playing ? "Pause" : "Play");
    lastAdvance = performance.now();
  });

  replayTickSlider?.addEventListener("input", () => {
    currentTick = Number(replayTickSlider.value);
    playing = false;
    replayPlayButton?.replaceChildren("Play");
    render();
  });

  replayCompareSelect?.addEventListener("change", () => {
    compareMode = (replayCompareSelect.value as ReplayCompareMode) || "seed";
    render();
  });

  const loop = (now: number) => {
    tickFps();
    if (playing && now - lastAdvance >= 680) {
      currentTick = currentTick >= totalTicks ? 0 : currentTick + 1;
      if (replayTickSlider) {
        replayTickSlider.value = currentTick.toString();
      }
      lastAdvance = now;
    }
    render();
    requestAnimationFrame(loop);
  };

  render();
  requestAnimationFrame(loop);
  console.log(
    `[Genesis] Replay diff viewer active. Use ?mode=replay&stack=${replayStack} to inspect this trace.`,
  );
}

async function bootstrap() {
  console.log("[O-64] Bootstrapping Genesis Ontology 10 Environment...");

  if (mode === "replay") {
    await bootstrapReplay();
    return;
  }

  // 0. Boot WebAssembly 128-bit SIMD Core
  const wasm = await initWasm();
  const wasmMemory = wasm.memory as WebAssembly.Memory;
  if (mode === "phase") {
    await bootstrapPhase(wasmMemory);
    return;
  }
  setInputMode("semantic");

  const wasmField = new Field(256, 256);
  console.log(
    `[O-64] Rust WASM SIMD Core initialized. Field base pointer allocated at memory offset: ${wasmField.ptr_x()}`,
  );

  // The WASM linear array natively acts as our global sync target.

  // 2. Map Visual Lens
  const isHybrid = mode === "hybrid";
  hudTitle?.replaceChildren(
    isHybrid ? "Σ³ Phase Bridge" : "Σ³ Semantic Coupler",
  );
  statusLabel?.replaceChildren(
    isHybrid ? "HYBRID PHASE ACTIVE" : "OMEGA-64 ACTIVE",
  );
  setHudStat(
    "a",
    isHybrid ? "GRID" : "MUTATION CANDIDATES",
    isHybrid ? "256x256" : "1024",
  );
  setHudStat("b", "FPS", "0");
  setHudStat(
    "c",
    isHybrid ? "SIGNATURE" : "OBSERVER",
    isHybrid ? "warming" : "WebGPU Lens",
  );
  const canvas = configureCanvas();

  // 3. Mount Substrate Observers
  const observer = new LensObserver(canvas, null);
  observer.setWasmContext(wasmField, wasmMemory);
  await observer.init();

  // 4. Initialize GPU Tournament Mutator
  // OBSOLETE: The GPU compute pipeline is deprecated in Ontology 11.
  // Darwinism is now executed natively in Rust WASM via horizontal gene transfer.

  // 5. Connect User Interaction Arrays
  const injector = new PerturbationInjector(canvas, wasmField);
  injector.attach();

  // 6. Bind the Semantic NLP Layer
  const coupler = new SemanticCoupler(injector);

  // Ontology 20: Ignite the Asynchronous Oracle Queue
  const oracle = new SovereignOracle(wasmField, wasmMemory);
  oracle.boot(); // Enable the queue processing flags

  // Front-End Reactivity
  wireSemanticInput(coupler, "Inject ontological intent...");

  // 7. Master Physics Rhythm
  const loop = () => {
    // Step 1: Execute WASM SIMD Tick natively
    // Provide a dummy LUT pointer (0) since trigonometry LUT isn't bound yet.
    if (isHybrid) {
      execute_phase_bridge_tick(wasmField, 0);
    } else {
      execute_simd_tick(wasmField, 0);
    }

    // Step 2: Draw mathematical Light
    observer.render();

    // Step 3: Service Asynchronous Oracle Queue
    oracle.sync();

    // System Telemetry
    tickFps();
    if (isHybrid && frames === 0) {
      setHudStat("a", "ENERGY", field_total_energy(wasmField).toString());
      setHudStat("c", "SIGNATURE", field_signature(wasmField).slice(0, 12));
      statusLabel?.replaceChildren(
        `PL ${field_total_plasmids(wasmField)} | LK ${
          field_total_locks(wasmField)
        } | Ω ${
          field_omega_span(wasmField)
        } | Q ${wasmField.get_oracle_request_count()}`,
      );
    }

    // Recursively drive the full unified pipeline
    requestAnimationFrame(loop);
  };

  loop();
  console.log(
    "[O-64] System breathing. Evolution pipeline running unconditionally.",
  );
}

bootstrap().catch(console.error);

function getSnapshotComparison(
  snapshots: PhaseField[],
  tick: number,
  compareMode: ReplayCompareMode,
): PhaseField | null {
  if (compareMode === "none") {
    return null;
  }
  if (compareMode === "seed") {
    return snapshots[0];
  }
  return tick > 0 ? snapshots[tick - 1] : null;
}
