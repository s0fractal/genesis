
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
    statDLabel: document.getElementById("stat-d-label") as HTMLSpanElement | null,
    statDValue: document.getElementById("stat-d-value") as HTMLSpanElement | null,
    statELabel: document.getElementById("stat-e-label") as HTMLSpanElement | null,
    statEValue: document.getElementById("stat-e-value") as HTMLSpanElement | null,
    statFLabel: document.getElementById("stat-f-label") as HTMLSpanElement | null,
    statFValue: document.getElementById("stat-f-value") as HTMLSpanElement | null,
    semanticInputGroup: document.getElementById("semantic-input-group") as HTMLDivElement | null,
    replayControls: document.getElementById("replay-controls") as HTMLDivElement | null,
    replayPlayButton: document.getElementById("replay-play") as HTMLButtonElement | null,
    replayTickSlider: document.getElementById("replay-tick") as HTMLInputElement | null,
    replayTickValue: document.getElementById("replay-tick-value") as HTMLSpanElement | null,
    replayCompareSelect: document.getElementById("replay-compare") as HTMLSelectElement | null,

    // Homeostasis Guard
    hMarkerEntropy: document.getElementById("h-marker-entropy") as HTMLDivElement | null,
    hMarkerEnergy: document.getElementById("h-marker-energy") as HTMLDivElement | null,
    hEntropyVal: document.getElementById("h-entropy-val") as HTMLSpanElement | null,
    hEnergyVal: document.getElementById("h-energy-val") as HTMLSpanElement | null,
    hEndocrineVal: document.getElementById("h-endocrine-val") as HTMLSpanElement | null,
    hToposVal: document.getElementById("h-topos-val") as HTMLSpanElement | null,
    hApexVal: document.getElementById("h-apex-val") as HTMLSpanElement | null,
    hFluxVal: document.getElementById("h-flux-val") as HTMLSpanElement | null,

    // Persistent State Controls
    btnSaveGenesis: document.getElementById("btn-save-genesis") as HTMLButtonElement | null,
    btnLoadGenesis: document.getElementById("btn-load-genesis") as HTMLButtonElement | null,
    btnConnectWallet: document.getElementById("btn-connect-wallet") as HTMLButtonElement | null,
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

export function wireSemanticInput(coupler: any, placeholder: string) {
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

  // ZK-Wallet EVM Integration
  if (DOM.btnConnectWallet) {
      DOM.btnConnectWallet.addEventListener("click", async () => {
          const ethWindow = globalThis as any;
          if (typeof ethWindow.ethereum !== 'undefined') {
              try {
                  const accounts = await ethWindow.ethereum.request({ method: 'eth_requestAccounts' });
                  const account = accounts[0];
                  if (DOM.btnConnectWallet) {
                      DOM.btnConnectWallet.innerText = `🟢 ${account.substring(0,6)}...${account.substring(38)}`;
                      DOM.btnConnectWallet.style.borderColor = "#00ffcc";
                      DOM.btnConnectWallet.style.color = "#00ffcc";
                  }
              } catch (error) {
                  console.error("User denied wallet connection", error);
              }
          } else {
              alert("Please install MetaMask or another Web3 EVM wallet to connect as a Verifier!");
          }
      });
  }
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
    d: { label: () => DOM.statDLabel, value: () => DOM.statDValue },
    e: { label: () => DOM.statELabel, value: () => DOM.statEValue },
    f: { label: () => DOM.statFLabel, value: () => DOM.statFValue },
} as const;

export function setHudStat(slot: "a" | "b" | "c" | "d" | "e" | "f", label: string, value: string) {
    STAT_SLOTS[slot].label()?.replaceChildren(label);
    STAT_SLOTS[slot].value()?.replaceChildren(value);
}

export function setInputMode(target: "semantic" | "replay") {
  DOM.semanticInputGroup?.toggleAttribute("hidden", target !== "semantic");
  DOM.replayControls?.toggleAttribute("hidden", target !== "replay");
}

let lastDomUpdate = 0;

export function updateHomeostasisHUD(
    entropy: number,
    energy: number,
    kuramoto: number,
    mutation: number,
    toposData?: {name: string, heat: number}[],
    apexData?: {hash: bigint, ast: string, energy: number, velocity: number}[],
    fluxData?: {sector: number; heat: number; dilation: number; avgCredit: number}[],
    hoveredAgent?: {hash: bigint, amp: number, lock: number, ent: number} | null
) {
    const now = performance.now();
    if (now - lastDomUpdate < 100) return; // Limit to 10 FPS
    lastDomUpdate = now;

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
    if (DOM.hToposVal) {
        if (hoveredAgent) {
            const hex = hoveredAgent.hash.toString(16).padStart(16, '0');
            DOM.hToposVal.replaceChildren(`🎯 LATCHED: 0x${hex} [AMP: ${hoveredAgent.amp} | LCK: ${hoveredAgent.lock} | ENT: ${hoveredAgent.ent}]`);
            DOM.hToposVal.style.color = '#00ffcc';
            DOM.hToposVal.style.textShadow = '0 0 8px #00ffcc';
        } else if (toposData) {
            DOM.hToposVal.style.color = '';
            DOM.hToposVal.style.textShadow = '';
            const toposStr = toposData
                .filter(t => t.heat > 0.1)
                .map(t => `${t.name}: ${t.heat.toFixed(1)}°`)
                .join(' | ');
            DOM.hToposVal.replaceChildren(toposStr || "ECOLOGICAL STASIS");
        }
    }
    if (DOM.hApexVal && apexData) {
        if (apexData.length === 0) {
            DOM.hApexVal.replaceChildren("Genetics Formatting...");
        } else {
            const out = apexData.slice(0, 3).map((a, i) => `#${i + 1} ⚡${a.energy.toString().padStart(5, '0')} v${a.velocity.toFixed(2)} [${a.hash.toString().substring(0,8)}]\n${a.ast}`).join('\n\n');
            DOM.hApexVal.replaceChildren(out);
        }
    }
    if (DOM.hFluxVal && fluxData) {
        if (fluxData.length === 0) {
            DOM.hFluxVal.replaceChildren("Mapping Phase Time...");
        } else {
            const out = fluxData.slice(0, 3).map((f) => `S[${f.sector.toString().padStart(2, '0')}] Heat: ${f.heat.toFixed(1)}° | Dilation: ${f.dilation.toFixed(2)}x [${f.avgCredit.toFixed(2)} cred]`).join('\n');
            DOM.hFluxVal.replaceChildren(out);
        }
    }
}
