import type { SemanticCoupler } from "../ontology/semantic_layer.ts";

export let frames = 0;
export let lastTime = performance.now();

export const DOM = {
    hudTitle: document.getElementById("hud-title") as HTMLDivElement | null,
    statusLabel: document.getElementById("status-label") as HTMLSpanElement | null,
    statALabel: document.getElementById("stat-a-label") as HTMLSpanElement | null,
    statAValue: document.getElementById("stat-a-value") as HTMLSpanElement | null,
    statBLabel: document.getElementById("stat-b-label") as HTMLSpanElement | null,
    statBValue: document.getElementById("stat-b-value") as HTMLSpanElement | null,
    statCLabel: document.getElementById("stat-c-label") as HTMLSpanElement | null,
    statCValue: document.getElementById("stat-c-value") as HTMLSpanElement | null,
    semanticInputGroup: document.getElementById("semantic-input-group") as HTMLDivElement | null,
    replayControls: document.getElementById("replay-controls") as HTMLDivElement | null,
    replayPlayButton: document.getElementById("replay-play") as HTMLButtonElement | null,
    replayTickSlider: document.getElementById("replay-tick") as HTMLInputElement | null,
    replayTickValue: document.getElementById("replay-tick-value") as HTMLSpanElement | null,
    replayCompareSelect: document.getElementById("replay-compare") as HTMLSelectElement | null,
    
    // O-58 Homeostasis Guard
    hMarkerEntropy: document.getElementById("h-marker-entropy") as HTMLDivElement | null,
    hMarkerEnergy: document.getElementById("h-marker-energy") as HTMLDivElement | null,
    hEntropyVal: document.getElementById("h-entropy-val") as HTMLSpanElement | null,
    hEnergyVal: document.getElementById("h-energy-val") as HTMLSpanElement | null,
    hEndocrineVal: document.getElementById("h-endocrine-val") as HTMLSpanElement | null,

    // O-59 Persistent State Controls
    btnSaveGenesis: document.getElementById("btn-save-genesis") as HTMLButtonElement | null,
    btnLoadGenesis: document.getElementById("btn-load-genesis") as HTMLButtonElement | null,
    fileLoadGenesis: document.getElementById("file-load-genesis") as HTMLInputElement | null,
};

export function configureCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById("lens-canvas") as HTMLCanvasElement;
  canvas.width = globalThis.innerWidth;
  canvas.height = globalThis.innerHeight;

  globalThis.addEventListener("resize", () => {
    canvas.width = globalThis.innerWidth;
    canvas.height = globalThis.innerHeight;
  });

  return canvas;
}

export function wireSemanticInput(coupler: SemanticCoupler, placeholder: string) {
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

export function tickFps() {
  frames++;
  const now = performance.now();
  if (now - lastTime > 1000) {
    DOM.statBValue?.replaceChildren(frames.toString());
    frames = 0;
    lastTime = now;
  }
}

const STAT_SLOTS = {
    a: { label: () => DOM.statALabel, value: () => DOM.statAValue },
    b: { label: () => DOM.statBLabel, value: () => DOM.statBValue },
    c: { label: () => DOM.statCLabel, value: () => DOM.statCValue },
} as const;

export function setHudStat(slot: "a" | "b" | "c", label: string, value: string) {
    STAT_SLOTS[slot].label()?.replaceChildren(label);
    STAT_SLOTS[slot].value()?.replaceChildren(value);
}

export function setInputMode(target: "semantic" | "replay") {
  DOM.semanticInputGroup?.toggleAttribute("hidden", target !== "semantic");
  DOM.replayControls?.toggleAttribute("hidden", target !== "replay");
}

export function updateHomeostasisHUD(entropy: number, energy: number, kuramoto: number, mutation: number) {
    if (DOM.hMarkerEntropy && DOM.hEntropyVal) {
        // Entropy scale: 0 to 6.0
        let ePct = (entropy / 6.0) * 100;
        if (ePct < 0) ePct = 0;
        if (ePct > 100) ePct = 100;
        DOM.hMarkerEntropy.style.setProperty("--h-pos", `${ePct}%`);
        DOM.hEntropyVal.replaceChildren(entropy.toFixed(2));
    }
    if (DOM.hMarkerEnergy && DOM.hEnergyVal) {
        // Energy scale: 0 to 100000
        let enPct = (energy / 100000) * 100;
        if (enPct < 0) enPct = 0;
        if (enPct > 100) enPct = 100;
        DOM.hMarkerEnergy.style.setProperty("--h-pos", `${enPct}%`);
        DOM.hEnergyVal.replaceChildren(Math.floor(energy).toString());
    }
    if (DOM.hEndocrineVal) {
        DOM.hEndocrineVal.replaceChildren(`K: ${kuramoto.toFixed(2)} | M: ${mutation.toFixed(1)}`);
    }
}
