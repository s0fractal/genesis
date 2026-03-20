import fs from "node:fs/promises";
const code = await fs.readFile(new URL("../src/lens/shaders/phase_lens.wgsl", import.meta.url), "utf-8");
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter?.requestDevice();
if (!device) {
    console.error("No WebGPU device");
    Deno.exit(1);
}
device.pushErrorScope("validation");
const module = device.createShaderModule({ code });
const info = await module.getCompilationInfo();
if (info.messages.length > 0) {
    for (const msg of info.messages) {
        console.error(`Line ${msg.lineNum}:${msg.linePos} - ${msg.message}`);
    }
} else {
    console.log("WGSL compiles perfectly.");
}
