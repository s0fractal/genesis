import initWasm, {
  execute_phase_bridge_tick,
  execute_simd_tick,
  Field,
  field_omega_span,
  field_signature,
  field_total_energy,
  field_total_locks,
  field_total_plasmids,
} from "../../omega_core/pkg/omega_core.js";
import { LensObserver } from "../lens/init.ts";
import { PerturbationInjector } from "../lens/input.ts";
import { SemanticCoupler } from "../ontology/semantic_layer.ts";
import { SovereignOracle } from "../ontology/oracle.ts";
import {
  configureCanvas,
  DOM,
  frames,
  setHudStat,
  setInputMode,
  tickFps,
  wireSemanticInput,
} from "./dom.ts";

export async function bootstrapClassic(mode: string) {
  console.log("[O-64] Bootstrapping Genesis Ontology 10 Environment...");

  // 0. Boot WebAssembly 128-bit SIMD Core
  const wasm = await initWasm();
  const wasmMemory = wasm.memory as WebAssembly.Memory;

  setInputMode("semantic");

  const wasmField = new Field(256, 256);
  console.log(
    `[O-64] Rust WASM SIMD Core initialized. Field base pointer allocated at memory offset: ${wasmField.ptr_x()}`,
  );

  // The WASM linear array natively acts as our global sync target.

  // 2. Map Visual Lens
  const isHybrid = mode === "hybrid";
  DOM.hudTitle?.replaceChildren(
    isHybrid ? "Σ³ Phase Bridge" : "Σ³ Semantic Coupler",
  );
  DOM.statusLabel?.replaceChildren(
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
      DOM.statusLabel?.replaceChildren(
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
