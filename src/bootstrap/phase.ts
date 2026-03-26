import { PhaseWebGPUObserver, TopologyMetadata } from "../lens/phase_webgpu.ts";
import { configureCanvas, DOM, frames, setHudStat, setInputMode, tickFps } from "./dom.ts";
import { SenateChatHUD } from "../ontology/senate_hud.ts";
import { PhylogenyView } from "../lens/phylogeny_view.ts";

export async function bootstrapPhase() {
  console.log("[Genesis] Bootstrapping Global Macro-Torus Worker Topology (Era 250: SharedWorker)...");

  // Init UI/Canvas
  const canvas = configureCanvas();
  let device: GPUDevice | null = null;
  
  try {
      if (!navigator.gpu) throw new Error("WebGPU API missing");
      const adapterPromise = navigator.gpu.requestAdapter();
      const timeoutPromise = new Promise<GPUAdapter | null>((_, reject) => setTimeout(() => reject(new Error("WebGPU Adapter Timeout")), 3000));
      const adapter = await Promise.race([adapterPromise, timeoutPromise]) as GPUAdapter | null;
      
      if (!adapter) throw new Error("WebGPU adapter unavailable");
      device = await adapter.requestDevice();
  } catch (err) {
      console.error("🛑 [O-243 FATAL] WebGPU Initialization Failed! Observer disabled.", err);
  }

  // Connect to the true sovereign simulation
  const worker = new SharedWorker(new URL('../workers/lattice_worker.ts', import.meta.url), { type: 'module' });
  
  worker.port.onmessage = async (e) => {
      const msg = e.data;
      if (msg.type === 'INIT_ACK') {
          await renderClientLoop(canvas, device, worker.port, msg.metadata);
      } else if (msg.type === 'INIT_ERR') {
          console.error("[Genesis] FATAL: Macro-Torus Worker Initialization Failed:", msg.error, "\nStack:", msg.stack);
      }
  };
  
  worker.port.postMessage({ type: 'HELO' });
}

  DOM.hudTitle?.replaceChildren("Φ Phase Lattice");
export async function renderClientLoop(canvas: HTMLCanvasElement, device: GPUDevice | null, workerPort: MessagePort, metadata: TopologyMetadata) {
  DOM.hudTitle?.replaceChildren("Φ Phase Lattice CPU");
  DOM.statusLabel?.replaceChildren("WORKER CONNECTED");
  setHudStat("a", "SECTORS", `${metadata.sectors}x${metadata.radial_bins}x${metadata.harmonics}`);
  setHudStat("b", "FPS", "0");
  setHudStat("c", "SIGNATURE", "federation");
  setInputMode("semantic");

  const observer = new PhaseWebGPUObserver(canvas, metadata, device);
  observer.workerPort = workerPort;
  await observer.init();
  
  const senateChat = new SenateChatHUD();
  
  // Era 268: Holographic Resonance DAG Overlay
  const phylogenyCanvas = document.createElement("canvas");
  phylogenyCanvas.id = "holo-resonance-ui";
  phylogenyCanvas.style.position = "absolute";
  phylogenyCanvas.style.top = "0";
  phylogenyCanvas.style.left = "0";
  phylogenyCanvas.style.width = "100%";
  phylogenyCanvas.style.height = "100%";
  phylogenyCanvas.style.pointerEvents = "none";
  phylogenyCanvas.style.zIndex = "100";
  document.body.appendChild(phylogenyCanvas);
  
  const phylogenyHUD = new PhylogenyView(phylogenyCanvas);

  let heatmapEnabled = false;
  globalThis.addEventListener("keydown", (e) => {
      if (e.key === "h" || e.key === "H") {
          heatmapEnabled = !heatmapEnabled;
          observer.heatmapEnabled = heatmapEnabled;
      }
  });

  let _hoveredAgent: { hash: bigint; amp: number; lock: number; ent: number; } | null = null;
  globalThis.addEventListener('gridHover', (e: Event) => {
      _hoveredAgent = (e as CustomEvent).detail;
  });

  // Track synchronized values from Headless Sandbox
  let current_tau = 0;
  let currentEntropy = 2.5;
  let globalEnergy = 0;
  let climate = "SPRING (Mutation)";
  let queueSize = 0;
  let apexPlasmids: {hash: string, astStr: string, energy: number}[] = [];

  workerPort.addEventListener('message', (e) => {
      const msg = e.data;
      if (msg.type === 'SYNC_METADATA') {
          current_tau = msg.current_tau;
          currentEntropy = msg.entropy;
          globalEnergy = msg.globalEnergy;
          climate = msg.climate;
          queueSize = msg.queueSize;
          apexPlasmids = msg.apexPlasmids;
      } else if (msg.type === 'FRAME_DATA') {
          current_tau = msg.tau;
          // Render reactively against the incoming Zero-Copy Transfer block
          observer.render(msg.buffer, current_tau);
      } else if (msg.type === 'SENATE_EVENT') {
          senateChat.handleEvent(msg.event);
      }
  });

  let lastPhylogenyCheck = performance.now();

  const loop = () => {
      const nowLocal = performance.now();

      // Renderer is now event-driven by FRAME_DATA

      // Local UI Animation Ticks
      if (nowLocal - lastPhylogenyCheck > 1000) {
          lastPhylogenyCheck = nowLocal;
          observer.choir.syncEcosystemVoices(apexPlasmids);
      }
      
      // Update Holographic metrics
      const kuramotoSync = Math.max(0.1, 1.0 - (currentEntropy / 4.0));
      phylogenyHUD.updateMetrics(currentEntropy, kuramotoSync);

      observer.choir.modulateParams(
          globalEnergy / 100000.0,
          Math.max(0, 1.0 - (queueSize / 20.0)),
          Math.max(0, 1.0 - (currentEntropy / 6.0)),
          (nowLocal % 5000) / 5000.0
      );

      tickFps();
      if (frames === 0) {
          DOM.statusLabel?.replaceChildren(`[${climate}] ENT ${currentEntropy.toFixed(2)} | Q ${queueSize} | Δ ${globalEnergy}`);
      }

      requestAnimationFrame(loop);
  };
  loop();
}
