import { PhaseComputeEngine } from "./src/lens/phase_compute.ts";
import { PhaseLatticeField } from "./omega_core/pkg/omega_core.js";
// Simple mock object to provoke the compilation error natively
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
try {
  const code = Deno.readTextFileSync("src/lens/shaders/compute_mycelial.wgsl");
  device.createShaderModule({ code });
  console.log("SHADER COMPILED NATIVELY.");
} catch(e) {
  console.error(e.message);
}
