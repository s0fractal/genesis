/**
 * OMEGA-64 Era 0200 — Living Museum
 *
 * Standalone public demo of the deterministic lattice.
 * Read-only mode: no WebRTC mesh, no ZK proofs, no oracles.
 * Pure observation + gentle interaction.
 */

import { OmegaV2Engine } from "../environment/v2_bridge.ts";
import { PhaseV2Renderer } from "../lens/v2_renderer.ts";
import { GENESIS_HASH_V1_0 } from "../network/genesis_inscription.ts";

const ENGINE = new OmegaV2Engine();
let renderer: PhaseV2Renderer | null = null;
let isPaused = false;
let animationId = 0;
let lastStatsUpdate = 0;

// Attractor presets (matrix, inverse, pulseFreq, pulseAmp)
const ATTRACTOR_PRESETS: [number, number, number, number][] = [
    [0x12345678, 0xEDCBA987, 440, 3000],   // 1: Aries — fast, tight
    [0xABCDEF01, 0x543210FE, 220, 2000],   // 2: Cancer — slow, wide
    [0xDEADBEEF, 0x21524110, 660, 4000],   // 3: Libra — harmonic, strong
    [0xCAFEBABE, 0x35014541, 110, 1500],   // 4: Capricorn — deep, gentle
];

async function boot() {
    console.log("🏛️ [MUSEUM] OMEGA-64 Living Museum booting...");

    const canvas = document.getElementById("lens-canvas") as HTMLCanvasElement;
    canvas.width = globalThis.innerWidth;
    canvas.height = globalThis.innerHeight;
    globalThis.addEventListener("resize", () => {
        canvas.width = globalThis.innerWidth;
        canvas.height = globalThis.innerHeight;
    });

    // WebGPU init
    if (!navigator.gpu) {
        alert("WebGPU is required for the Living Museum. Please use Chrome 113+ or Edge 113+.");
        return;
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        alert("WebGPU adapter unavailable.");
        return;
    }
    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu") as unknown as GPUCanvasContext;
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: "premultiplied" });

    // Boot engine
    await ENGINE.boot(adapter);
    const ptrs = ENGINE.getMemoryPointers();

    // Big Bang — museum scale (~100k agents)
    const bigBang = ENGINE.wasm!.exports.v2_ignite_big_bang as CallableFunction;
    bigBang(0x64_4D_53_45, 100_000);
    console.log("🎆 [MUSEUM] Big Bang ignited: 100,000 agents.");

    // Renderer
    renderer = new PhaseV2Renderer(context, device, format, ENGINE);
    await renderer.initialize();
    renderer.setComputeMode("toroidal"); // Exact Rust parity for museum stability

    // HUD init
    const genesisHex = GENESIS_HASH_V1_0.toString(16).toUpperCase().padStart(8, "0");
    document.getElementById("genesis-hash")!.textContent = `0x${genesisHex}`;

    // Interaction: mouse attractor injection
    let isMouseDown = false;
    canvas.addEventListener("mousedown", (e) => { isMouseDown = true; injectAttractor(e); });
    canvas.addEventListener("mousemove", (e) => { if (isMouseDown) injectAttractor(e); });
    canvas.addEventListener("mouseup", () => { isMouseDown = false; });
    canvas.addEventListener("mouseleave", () => { isMouseDown = false; });

    // Interaction: keyboard presets
    globalThis.addEventListener("keydown", (e) => {
        const key = e.key;
        if (key === " ") {
            isPaused = !isPaused;
            updateHudStat("f", "Mode", isPaused ? "PAUSED" : "OBSERVING");
            e.preventDefault();
        } else if (key === "h" || key === "H" || key === "?") {
            toggleInfo(true);
        } else if (key >= "1" && key <= "4") {
            const idx = parseInt(key) - 1;
            const [m, i, f, a] = ATTRACTOR_PRESETS[idx];
            setAttractor(0, m, i, f, a);
            console.log(`[MUSEUM] Preset ${key} loaded.`);
        }
    });

    // Buttons
    document.getElementById("btn-info")!.addEventListener("click", () => toggleInfo(true));
    document.getElementById("btn-close-info")!.addEventListener("click", () => toggleInfo(false));
    document.getElementById("btn-export")!.addEventListener("click", exportWitness);

    // Start loop
    requestAnimationFrame(frameLoop);
    console.log("🏛️ [MUSEUM] Loop started. Press H for help.");
}

function frameLoop() {
    animationId = requestAnimationFrame(frameLoop);
    if (isPaused || !renderer) return;

    renderer.tick();

    // Stats throttled to 10 Hz
    const now = performance.now();
    if (now - lastStatsUpdate > 100) {
        lastStatsUpdate = now;
        updateStats();
    }
}

function updateStats() {
    const ptrs = ENGINE.getMemoryPointers();
    const signals = new DataView(ptrs.uniformBytes.buffer, ptrs.uniformBytes.byteOffset, 32);
    const activeCount = signals.getUint32(24, true);
    const tick = signals.getUint32(4, true);

    // Resonance scan
    const res = ENGINE.scanResonance();
    const rNorm = res.r_q10 / 1024;

    // Golden trace
    const traceNum = (ENGINE.wasm!.exports.v2_get_golden_trace as CallableFunction)() as number;
    const traceHex = traceNum.toString(16).toUpperCase().padStart(8, "0");

    // Attractor count
    const attractorArr = new DataView(ptrs.attractorBytes.buffer, ptrs.attractorBytes.byteOffset, 80);
    const attractorCount = attractorArr.getUint32(0, true);

    updateHudStat("a", "Agents", activeCount.toLocaleString());
    updateHudStat("b", "Tick", tick.toLocaleString());
    updateHudStat("c", "Resonance", rNorm.toFixed(3));
    updateHudStat("d", "Golden Trace", `0x${traceHex}`);
    updateHudStat("e", "Attractors", attractorCount.toString());
}

function updateHudStat(_slot: string, label: string, value: string) {
    // Minimal HUD: find by label textContent and update sibling
    const hud = document.querySelector(".hud-top-left")!;
    const rows = hud.querySelectorAll(".hud-row");
    for (const row of rows) {
        const lbl = row.querySelector(".label");
        if (lbl && lbl.textContent === label) {
            const val = row.querySelector(".value");
            if (val) val.textContent = value;
            return;
        }
    }
}

function injectAttractor(e: MouseEvent) {
    const canvas = e.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2.0 - 1.0;
    const y = -(((e.clientY - rect.top) / rect.height) * 2.0 - 1.0);
    const ix = Math.floor(x * 1000);
    const iy = Math.floor(y * 1000);

    // Inject via intent slot 0 (local user)
    const setIntent = ENGINE.wasm?.exports.v2_set_intent as CallableFunction;
    if (setIntent) {
        const packedMass = 2500 | (0 << 16); // benign attractor
        setIntent(0, ix, iy, packedMass, 200, 0x00FFCC, 0);
    }

    // Also set a real attractor in the field (slot 0)
    const setAttractorFn = ENGINE.wasm?.exports.v2_set_attractor as CallableFunction;
    if (setAttractorFn) {
        const [m, i, f, a] = ATTRACTOR_PRESETS[0];
        setAttractorFn(0, m, i, f, a);
    }
}

function setAttractor(slot: number, matrix: number, inverse: number, freq: number, amp: number) {
    const fn = ENGINE.wasm?.exports.v2_set_attractor as CallableFunction;
    if (fn) fn(slot, matrix >>> 0, inverse >>> 0, freq, amp);
}

function toggleInfo(show: boolean) {
    const panel = document.getElementById("info-panel")!;
    panel.classList.toggle("active", show);
}

function exportWitness() {
    const traceNum = (ENGINE.wasm!.exports.v2_get_golden_trace as CallableFunction)() as number;
    const ptrs = ENGINE.getMemoryPointers();
    const signals = new DataView(ptrs.uniformBytes.buffer, ptrs.uniformBytes.byteOffset, 32);
    const tick = signals.getUint32(4, true);
    const active = signals.getUint32(24, true);

    const witness = {
        schema: "OMEGA-MUSEUM-WITNESS/v1",
        genesis: GENESIS_HASH_V1_0.toString(16).padStart(8, "0"),
        timestamp: Date.now(),
        tick,
        active_agents: active,
        golden_trace: traceNum.toString(16).padStart(8, "0").toUpperCase(),
        url: globalThis.location.href,
    };

    const blob = new Blob([JSON.stringify(witness, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omega64-witness-${witness.golden_trace}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log("🏛️ [MUSEUM] Witness exported:", witness);
}

// Auto-boot
boot().catch((e) => {
    console.error("[MUSEUM] Boot failure:", e);
});
