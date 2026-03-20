// deno-lint-ignore-file
import puppeteer, { ConsoleMessage } from "npm:puppeteer";

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", (msg: ConsoleMessage) => {
    console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  // deno-lint-ignore no-explicit-any
  page.on("pageerror", (err: any) => {
    console.error(`[BROWSER ERROR] ${err.toString()}`);
  });

  console.log("Navigating to Genesis...");
  await page.goto("http://localhost:5173/?mode=classic", {
    waitUntil: "networkidle0",
  });

  console.log("Injecting semantic resonance...");
  await page.waitForSelector("#semantic-input");
  await page.type("#semantic-input", "trigger oracle vision");

  for (let i = 0; i < 25; i++) {
    await page.click("#semantic-submit");
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log("Waiting for Oracle to manifest vision...");
  await new Promise((r) => setTimeout(r, 3000));

  const visionSrc = await page.evaluate(() => {
    const img = document.getElementById(
      "oracle-debug-vision",
    ) as HTMLImageElement;
    return img ? img.src : null;
  });

  console.log(`Vision Src Length: ${visionSrc ? visionSrc.length : "NULL"}`);
  if (visionSrc && visionSrc.length > 50) {
    console.log(
      "SUCCESS: Base64 Vision successfully extracted via WebGPU 2D Context!",
    );
  } else {
    console.log("FAILED: Vision src is empty or null.");
  }

  await browser.close();
}

run();
