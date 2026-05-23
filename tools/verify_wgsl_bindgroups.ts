// deno-lint-ignore-file
const kura = await Deno.readTextFile(
  new URL("../src/lens/shaders/compute_kuramoto.wgsl", import.meta.url),
);
const myc = await Deno.readTextFile(
  new URL("../src/lens/shaders/compute_mycelial.wgsl", import.meta.url),
);

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter?.requestDevice();

if (!device) throw new Error("No WebGPU available");

// deno-lint-ignore no-explicit-any
(device as any).onuncapturederror = ((event: any) => {
  console.error("UNCAPTURED ERROR:", event.error);
}) as any;

const kMod = device.createShaderModule({ code: kura });
const mMod = device.createShaderModule({ code: myc });

const kPipe = device.createComputePipeline({
  layout: "auto",
  compute: { module: kMod, entryPoint: "main" },
});
const mPipe = device.createComputePipeline({
  layout: "auto",
  compute: { module: mMod, entryPoint: "main" },
});

// Fake buffers
const bufA = device.createBuffer({
  size: 1920 * 8,
  usage: GPUBufferUsage.STORAGE,
});
const bufB = device.createBuffer({
  size: 1920 * 8,
  usage: GPUBufferUsage.STORAGE,
});
const padUniform = device.createBuffer({
  size: 112,
  usage: GPUBufferUsage.UNIFORM,
});
const mycBuf = device.createBuffer({
  size: 16384,
  usage: GPUBufferUsage.STORAGE,
});

console.log("Creating Kuramoto BindGroup...");
device.pushErrorScope("validation");
device.createBindGroup({
  layout: kPipe.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: bufA } },
    { binding: 1, resource: { buffer: bufB } },
    { binding: 2, resource: { buffer: padUniform } },
    { binding: 3, resource: { buffer: mycBuf } },
  ],
});
const errK = await device.popErrorScope();
if (errK) console.error("K BIND ERROR:", errK.message);

console.log("Creating Mycelial BindGroup...");
device.pushErrorScope("validation");
device.createBindGroup({
  layout: mPipe.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: bufA } },
    { binding: 2, resource: { buffer: padUniform } },
    { binding: 3, resource: { buffer: mycBuf } },
  ],
});
const errM = await device.popErrorScope();
if (errM) console.error("M BIND ERROR:", errM.message);

console.log("Done.");
