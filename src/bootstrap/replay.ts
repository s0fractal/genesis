import { PhaseReplayObserver } from "../lens/phase_replay_view.ts";
import {
  buildDiffSummary,
  getReplayComparison,
  getReplaySnapshot,
  loadPhaseReplayDataset,
  summarizeReplayDiff,
} from "../replay/phase_replay.ts";
import type { ReplayCompareMode, PhaseField } from "../replay/phase_replay.ts";
import {
  configureCanvas,
  DOM,
  setHudStat,
  setInputMode,
  tickFps,
} from "./dom.ts";

export async function bootstrapReplay(replayStack: string) {
  console.log(
    `[Genesis] Bootstrapping replay diff mode for stack=${replayStack}...`,
  );
  DOM.hudTitle?.replaceChildren(
    replayStack === "cross"
      ? "Φ Cross Diff"
      : replayStack === "hybrid"
      ? "Φ Hybrid Replay"
      : "Φ Replay Diff",
  );
  DOM.statusLabel?.replaceChildren("LOADING CANONICAL TRACE");
  setHudStat("a", "TICK", "0/0");
  setHudStat("b", "FPS", "0");
  setHudStat("c", "PARITY", "loading");
  setInputMode("replay");

  const canvas = configureCanvas();
  const observer = new PhaseReplayObserver(canvas);
  observer.init();

  const phaseDataset = await loadPhaseReplayDataset();
  let currentTick = 0;
  let compareMode: ReplayCompareMode = "seed";
  let playing = false;
  let lastAdvance = performance.now();
  const totalTicks = phaseDataset.golden.ticks;

  if (DOM.replayTickSlider) {
    DOM.replayTickSlider.min = "0";
    DOM.replayTickSlider.max = totalTicks.toString();
    DOM.replayTickSlider.step = "1";
    DOM.replayTickSlider.value = "0";
  }
  DOM.replayTickValue?.replaceChildren(`0/${totalTicks}`);
  if (DOM.replayCompareSelect) {
    DOM.replayCompareSelect.value = compareMode;
    DOM.replayCompareSelect.disabled = replayStack === "cross";
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
      DOM.statusLabel?.replaceChildren(
        `${compareMode.toUpperCase()} Δ${summary.changedCells} | REF ${
          referenceTrace.structuralSignature.slice(0, 8)
        } | WASM ${wasmTrace.structuralSignature.slice(0, 8)}`,
      );

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
    DOM.replayTickValue?.replaceChildren(`${boundedTick}/${totalTicks}`);
  };

  DOM.replayPlayButton?.addEventListener("click", () => {
    playing = !playing;
    DOM.replayPlayButton?.replaceChildren(playing ? "Pause" : "Play");
    lastAdvance = performance.now();
  });

  DOM.replayTickSlider?.addEventListener("input", () => {
    if (DOM.replayTickSlider) {
      currentTick = Number(DOM.replayTickSlider.value);
    }
    playing = false;
    DOM.replayPlayButton?.replaceChildren("Play");
    render();
  });

  DOM.replayCompareSelect?.addEventListener("change", () => {
    if (DOM.replayCompareSelect) {
      compareMode = (DOM.replayCompareSelect.value as ReplayCompareMode) || "seed";
    }
    render();
  });

  const loop = (now: number) => {
    tickFps();
    if (playing && now - lastAdvance >= 680) {
      currentTick = currentTick >= totalTicks ? 0 : currentTick + 1;
      if (DOM.replayTickSlider) {
        DOM.replayTickSlider.value = currentTick.toString();
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
