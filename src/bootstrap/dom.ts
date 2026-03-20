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
};

export function configureCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById("lens-canvas") as HTMLCanvasElement;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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

export function setHudStat(slot: "a" | "b" | "c", label: string, value: string) {
  if (slot === "a") {
    DOM.statALabel?.replaceChildren(label);
    DOM.statAValue?.replaceChildren(value);
    return;
  }
  if (slot === "b") {
    DOM.statBLabel?.replaceChildren(label);
    DOM.statBValue?.replaceChildren(value);
    return;
  }
  DOM.statCLabel?.replaceChildren(label);
  DOM.statCValue?.replaceChildren(value);
}

export function setInputMode(target: "semantic" | "replay") {
  DOM.semanticInputGroup?.toggleAttribute("hidden", target !== "semantic");
  DOM.replayControls?.toggleAttribute("hidden", target !== "replay");
}
