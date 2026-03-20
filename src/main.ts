import initWasm, {
    Field,
    PhaseLatticeField,
    execute_phase_bridge_tick,
    execute_phase_lattice_tick,
    execute_simd_tick,
    field_omega_span,
    field_signature,
    field_total_energy,
    field_total_locks,
    field_total_plasmids,
    phase_lattice_omega_span,
    phase_lattice_signature,
    phase_lattice_total_amplitude,
    phase_lattice_total_entanglement,
} from "../omega_core/pkg/omega_core.js";
import { LensObserver } from "./lens/init";
import { PerturbationInjector } from "./lens/input";
import { PhasePerturbationInjector } from "./lens/phase_input";
import { PhaseReplayObserver } from "./lens/phase_replay_view";
import { PhaseWebGPUObserver } from "./lens/phase_webgpu";
import { SemanticCoupler } from "./ontology/semantic_layer";
import { SovereignOracle } from "./ontology/oracle";
import {
    buildDiffSummary,
    getReplayComparison,
    getReplaySnapshot,
    loadPhaseReplayDataset,
    summarizeReplayDiff,
} from "./replay/phase_replay";
import {
    collapsePhaseField,
    cropPhaseField,
    hybridSnapshotSignature,
    loadHybridReplayDataset,
} from "./replay/hybrid_replay";
import type { ReplayCompareMode } from "./replay/phase_replay";
import type { PhaseField } from "./shared/phase_lattice";

let lastTime = performance.now();
let frames = 0;
const hudTitle = document.getElementById("hud-title") as HTMLDivElement | null;
const statusLabel = document.getElementById("status-label") as HTMLSpanElement | null;
const statALabel = document.getElementById("stat-a-label") as HTMLSpanElement | null;
const statAValue = document.getElementById("stat-a-value") as HTMLSpanElement | null;
const statBLabel = document.getElementById("stat-b-label") as HTMLSpanElement | null;
const statBValue = document.getElementById("stat-b-value") as HTMLSpanElement | null;
const statCLabel = document.getElementById("stat-c-label") as HTMLSpanElement | null;
const statCValue = document.getElementById("stat-c-value") as HTMLSpanElement | null;
const semanticInputGroup = document.getElementById("semantic-input-group") as HTMLDivElement | null;
const replayControls = document.getElementById("replay-controls") as HTMLDivElement | null;
const replayPlayButton = document.getElementById("replay-play") as HTMLButtonElement | null;
const replayTickSlider = document.getElementById("replay-tick") as HTMLInputElement | null;
const replayTickValue = document.getElementById("replay-tick-value") as HTMLSpanElement | null;
const replayCompareSelect = document.getElementById("replay-compare") as HTMLSelectElement | null;
const mode = new URLSearchParams(window.location.search).get("mode") || "classic";
const replayStack = new URLSearchParams(window.location.search).get("stack") || "phase";

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
    const button = document.getElementById("semantic-submit") as HTMLButtonElement;
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
    const phaseField = new PhaseLatticeField(64, 10, 3);
    const observer = new PhaseWebGPUObserver(canvas, phaseField, wasmMemory);
    await observer.init();

    const injector = new PhasePerturbationInjector(canvas, phaseField, wasmMemory);
    injector.attach();

    const coupler = new SemanticCoupler(injector);
    wireSemanticInput(coupler, "Inject phase attractor...");

    // O-22: Bind the Sovereign Oracle purely to the Phase Lattice
    const oracle = new SovereignOracle(phaseField, wasmMemory);
    oracle.boot();

    const loop = () => {
        execute_phase_lattice_tick(phaseField);
        oracle.sync();

        observer.render();
        tickFps();

        if (frames === 0) {
            setHudStat("a", "AMPLITUDE", phase_lattice_total_amplitude(phaseField).toString());
            setHudStat("c", "SIGNATURE", phase_lattice_signature(phaseField).slice(0, 12));
            statusLabel?.replaceChildren(`ENT ${phase_lattice_total_entanglement(phaseField)} | Ω ${phase_lattice_omega_span(phaseField)} | Q ${phaseField.get_oracle_request_count()}`);
        }

        requestAnimationFrame(loop);
    };

    loop();
    console.log("[Genesis] Phase lattice running. Use ?mode=phase to revisit this substrate.");
}

async function bootstrapReplay() {
    console.log(`[Genesis] Bootstrapping replay diff mode for stack=${replayStack}...`);
    hudTitle?.replaceChildren(replayStack === "cross" ? "Φ Cross Diff" : replayStack === "hybrid" ? "Φ Hybrid Replay" : "Φ Replay Diff");
    statusLabel?.replaceChildren("LOADING CANONICAL TRACE");
    setHudStat("a", "TICK", "0/0");
    setHudStat("b", "FPS", "0");
    setHudStat("c", replayStack === "phase" ? "PARITY" : replayStack === "hybrid" ? "TRACE" : "MODE", "loading");
    setInputMode("replay");

    const canvas = configureCanvas();
    const observer = new PhaseReplayObserver(canvas);
    observer.init();

    const phaseDataset = await loadPhaseReplayDataset();
    const wasm = replayStack === "phase" ? null : await initWasm();
    const hybridDataset = wasm ? await loadHybridReplayDataset(wasm) : null;
    let currentTick = 0;
    let compareMode: ReplayCompareMode = "seed";
    let playing = false;
    let lastAdvance = performance.now();
    const commonTicks = hybridDataset ? Math.min(phaseDataset.golden.ticks, hybridDataset.golden.ticks) : phaseDataset.golden.ticks;
    const totalTicks = replayStack === "hybrid" && hybridDataset ? hybridDataset.golden.ticks : replayStack === "cross" ? commonTicks : phaseDataset.golden.ticks;

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
            compare = getSnapshotComparison(hybridDataset.snapshots, boundedTick, compareMode);
            const hybridTrace = hybridDataset.golden.wasmTrace[boundedTick];
            summary = buildDiffSummary(
                current,
                compare,
                hybridSnapshotSignature(current),
                hybridTrace.signature,
                false,
            );
            title = "hybrid replay";
            statusLine = `compare ${compareMode} | trace ${hybridTrace.signature.slice(0, 8)} | Ω ${hybridTrace.omegaSpan}`;
            leftLabel = "view";
            rightLabel = "golden";
            setHudStat("c", "TRACE", hybridTrace.signature.slice(0, 12));
            statusLabel?.replaceChildren(`HYBRID Δ${summary.changedCells} | RAW ${hybridTrace.signature.slice(0, 8)} | Ω ${hybridTrace.omegaSpan}`);
        } else if (replayStack === "cross" && hybridDataset) {
            current = collapsePhaseField(getReplaySnapshot(phaseDataset, boundedTick), 6);
            compare = cropPhaseField(hybridDataset.snapshots[boundedTick], current.shape.radialBins);
            summary = buildDiffSummary(
                current,
                compare,
                hybridSnapshotSignature(current),
                hybridSnapshotSignature(compare),
                false,
            );
            title = "phase vs hybrid";
            statusLine = "cross diff | phase collapsed to 1 harmonic | hybrid cropped to 6 rings";
            leftLabel = "phase";
            rightLabel = "hybrid";
            setHudStat("c", "MODE", "PH↔HY");
            statusLabel?.replaceChildren(
                `CROSS Δ${summary.changedCells} | PH ${summary.referenceStructuralSignature.slice(0, 8)} | HY ${summary.wasmStructuralSignature.slice(0, 8)}`,
            );
        } else {
            current = getReplaySnapshot(phaseDataset, boundedTick);
            compare = getReplayComparison(phaseDataset, boundedTick, compareMode);
            summary = summarizeReplayDiff(phaseDataset, boundedTick, compareMode);
            const referenceTrace = phaseDataset.golden.referenceTrace[boundedTick];
            const wasmTrace = phaseDataset.golden.wasmTrace[boundedTick];
            title = "phase replay";
            statusLine = `compare ${compareMode} | parity ${summary.parityLocked ? "locked" : "drift"}`;
            leftLabel = "ref";
            rightLabel = "wasm";
            setHudStat("c", "PARITY", summary.parityLocked ? "LOCKED" : "DRIFT");
            statusLabel?.replaceChildren(
                `${compareMode.toUpperCase()} Δ${summary.changedCells} | REF ${referenceTrace.structuralSignature.slice(0, 8)} | WASM ${wasmTrace.structuralSignature.slice(0, 8)}`,
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
    console.log(`[Genesis] Replay diff viewer active. Use ?mode=replay&stack=${replayStack} to inspect this trace.`);
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
    console.log(`[O-64] Rust WASM SIMD Core initialized. Field base pointer allocated at memory offset: ${wasmField.ptr_x()}`);

    // The WASM linear array natively acts as our global sync target.

    // 2. Map Visual Lens
    const isHybrid = mode === "hybrid";
    hudTitle?.replaceChildren(isHybrid ? "Σ³ Phase Bridge" : "Σ³ Semantic Coupler");
    statusLabel?.replaceChildren(isHybrid ? "HYBRID PHASE ACTIVE" : "OMEGA-64 ACTIVE");
    setHudStat("a", isHybrid ? "GRID" : "MUTATION CANDIDATES", isHybrid ? "256x256" : "1024");
    setHudStat("b", "FPS", "0");
    setHudStat("c", isHybrid ? "SIGNATURE" : "OBSERVER", isHybrid ? "warming" : "WebGPU Lens");
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
            statusLabel?.replaceChildren(`PL ${field_total_plasmids(wasmField)} | LK ${field_total_locks(wasmField)} | Ω ${field_omega_span(wasmField)} | Q ${wasmField.get_oracle_request_count()}`);
        }

        // Recursively drive the full unified pipeline
        requestAnimationFrame(loop);
    };

    loop();
    console.log("[O-64] System breathing. Evolution pipeline running unconditionally.");
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
