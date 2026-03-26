import { PhaseWebGPUObserver, TopologyMetadata } from "../lens/phase_webgpu.ts";
import { configureCanvas, DOM, frames, setHudStat, setInputMode, tickFps } from "./dom.ts";
import { SenateChatHUD } from "../ontology/senate_hud.ts";
import { PhylogenyView } from "../lens/phylogeny_view.ts";
import { WebRTCMesh } from "../network/webrtc_mesh.ts";

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
  const worker = new Worker(new URL('../workers/lattice_worker.ts', import.meta.url), { type: 'module' });
  
  worker.onmessage = async (e) => {
      const msg = e.data;
      if (msg.type === 'WGSL_ERR') {
          let errDiv = document.getElementById('wgsl-err-main');
          if (!errDiv) {
              errDiv = document.createElement('div');
              errDiv.id = 'wgsl-err-main';
              errDiv.style.cssText = 'position:fixed;top:10px;left:10px;color:white;z-index:9999;font-size:12px;background:rgba(255,0,0,0.9);padding:10px;font-family:monospace;max-width:80vw;white-space:pre-wrap;';
              document.body.appendChild(errDiv);
          }
          errDiv.innerText += msg.msg + '\n';
      } else if (msg.type === 'INIT_ACK') {
          await renderClientLoop(canvas, device, worker, msg.metadata);
      } else if (msg.type === 'INIT_ERR') {
          console.error("[Genesis] FATAL: Macro-Torus Worker Initialization Failed:", msg.error, "\nStack:", msg.stack);
      }
  };
  
  worker.postMessage({ type: 'HELO' });
}

  DOM.hudTitle?.replaceChildren("Φ Phase Lattice");
export async function renderClientLoop(canvas: HTMLCanvasElement, device: GPUDevice | null, workerPort: Worker | MessagePort, metadata: TopologyMetadata) {
  DOM.hudTitle?.replaceChildren("Φ Phase Lattice CPU");
  DOM.statusLabel?.replaceChildren("WORKER CONNECTED");
  setHudStat("a", "SECTORS", `${metadata.sectors}x${metadata.radial_bins}x${metadata.harmonics}`);
  setHudStat("b", "FPS", "0");
  setHudStat("c", "SIGNATURE", "federation");
  setInputMode("semantic");

  // Era 300: Spawn Native WebRTC Mesh for the UI Thread
  const mesh = new WebRTCMesh(workerPort as unknown as MessagePort, "ws://localhost:9091");

  const observer = new PhaseWebGPUObserver(canvas, metadata, device);
  observer.workerPort = workerPort as unknown as MessagePort;
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

  let _hoveredAgent: {
    ptr_spatial_memory_theta?: number;
    ptr_spatial_memory_strength?: number;
    ring_buffer?: SharedArrayBuffer;
    slot_size?: number;
  } | null = null;
  globalThis.addEventListener('gridHover', (e: Event) => {
      _hoveredAgent = (e as CustomEvent).detail;
  });

  // Track synchronized values from Headless Sandbox
  let current_tau = 0;
  let currentEntropy = 2.5;
  let globalEnergy = 0;
  let climate = "SPRING (Mutation)";
  let queueSize = 0;
  let nomosVerified = 0;
  let nomosOrphaned = 0;
  let apexPlasmids: {hash: string, astStr: string, energy: number}[] = [];
  let latestFallbackFrame: { buffer: ArrayBuffer, tau: number } | null = null;

  workerPort.addEventListener('message', (e: Event) => {
      const msg = (e as MessageEvent).data;
        if (msg.type === 'SYNC_METADATA') {
            current_tau = msg.current_tau;
            currentEntropy = msg.entropy;
            globalEnergy = msg.globalEnergy;
            climate = msg.climate;
            queueSize = msg.queueSize;
            nomosVerified = msg.nomosVerified || 0;
            nomosOrphaned = msg.nomosOrphaned || 0;
            apexPlasmids = msg.apexPlasmids;
        } else if (msg.type === 'HALO_SYNC' || msg.type === 'FOREIGN_PLASMID') {
          mesh.broadcast(msg);
      } else if (msg.type === 'SENATE_EVENT') {
          senateChat.handleEvent(msg.event);
      } else if (msg.type === 'P2P_BROADCAST') {
          mesh.broadcast(msg.payload);
      } else if (msg.type === 'FRAME_FALLBACK') {
          if (latestFallbackFrame) {
              workerPort.postMessage({ type: 'RECYCLE_BUFFER', buffer: latestFallbackFrame.buffer }, [latestFallbackFrame.buffer]);
          }
          latestFallbackFrame = { buffer: msg.buffer, tau: msg.tau };
      }
  });

  let lastPhylogenyCheck = performance.now();

  // Era 850: Watch the SAB synchronously across the worker via WASM pointers
  if (metadata.ring_buffer && metadata.slot_size && metadata.ring_buffer_ptr !== undefined) {
      const ringBuffer = metadata.ring_buffer;
      const ringPtr = metadata.ring_buffer_ptr;
      const slotSize = metadata.slot_size;
      const header = new Int32Array(ringBuffer, ringPtr, 4);
      
      const watchFrames = async () => {
          let lastFlag = Atomics.load(header, 0);
          while (true) {
              if (header.buffer instanceof SharedArrayBuffer) {
                  const result = (Atomics as any).waitAsync(header, 0, lastFlag);
                  if (result.async) {
                      await result.value;
                  }
                  
                  lastFlag = Atomics.load(header, 0);
                  const slotIdx = lastFlag % 3;
                  const tau = Atomics.load(header, 3);
                  const offset = ringPtr + 16 + slotIdx * slotSize;
                  const view = new Uint8Array(ringBuffer, offset, slotSize);
                  
                  observer.render(view, tau);
                  current_tau = tau;
                  
                  await new Promise(r => requestAnimationFrame(r));
              } else {
                  // Era 850 Fallback: Decoupled Polling (Non-Blocking)
                  while (!latestFallbackFrame) {
                      await new Promise(r => requestAnimationFrame(r));
                  }
                  
                  const frame = latestFallbackFrame;
                  latestFallbackFrame = null;
                  
                  const view = new Uint8Array(frame.buffer);
                  observer.render(view, frame.tau);
                  current_tau = frame.tau;
                  
                  // Recycle the buffer to prevent WASM clones leaking memory over the event loop
                  workerPort.postMessage({ type: 'RECYCLE_BUFFER', buffer: frame.buffer }, [frame.buffer]);
                  
                  await new Promise(r => requestAnimationFrame(r));
              }
          }
      };
      watchFrames();
  }

  const loop = () => {
      const nowLocal = performance.now();

      // Area 850: Pointer-based Telemetry
      if (metadata.telemetry_ptr !== undefined && metadata.ring_buffer) {
          const tView = new Float32Array(metadata.ring_buffer, metadata.telemetry_ptr, 8);
          currentEntropy = tView[0];
      }

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
          DOM.statusLabel?.replaceChildren(`[${climate}] ENT ${currentEntropy.toFixed(2)} | Q ${queueSize} | Δ ${globalEnergy} | ZK-V: ${nomosVerified} ZK-X: ${nomosOrphaned}`);
      }

      requestAnimationFrame(loop);
  };
  loop();
}
