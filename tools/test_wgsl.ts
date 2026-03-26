const computeHoloWgsl = Deno.readTextFileSync("src/lens/shaders/compute_hologram.wgsl");
const holoLensWgsl = Deno.readTextFileSync("src/lens/shaders/holo_lens.wgsl");

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) throw new Error("No adapter");
const device = await adapter.requestDevice();

try {
  device.createShaderModule({ code: computeHoloWgsl });
  console.log("compute_hologram.wgsl OK");
} catch (e) {
  console.error("compute_hologram.wgsl Error:", e);
}

try {
  device.createShaderModule({ code: holoLensWgsl });
  console.log("holo_lens.wgsl OK");
} catch (e) {
  console.error("holo_lens.wgsl Error:", e);
}
