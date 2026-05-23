import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test({
  name: "🏛️  Museum WebGPU Smoke Test",
  ignore: Deno.env.get("CI") === "true", // Requires real GPU/Browser, usually flaky in pure CI unless configured.
  async fn() {
    const { default: puppeteer } = await import("npm:puppeteer");
    console.log("\n[TEST] Booting Puppeteer...");
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath:
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        args: [
          "--enable-unsafe-webgpu",
          "--no-sandbox",
        ],
      });
    } catch (e) {
      console.log(
        "⚠️ Puppeteer failed to launch native Chrome. Skipping smoke test.",
      );
      return;
    }

    try {
      const page = await browser.newPage();
      page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));

      // We assume `deno task serve` (vite preview) is running on port 4173
      console.log("[TEST] Navigating to Museum...");

      // We use a try-catch for navigation just in case the server isn't running,
      // we will skip the test rather than fail it if the dev server isn't up.
      try {
        await page.goto("http://localhost:4173/museum.html", {
          waitUntil: "networkidle2",
        });
      } catch (err) {
        console.log(
          "⚠️ Dev server not running on 4173. Skipping Museum smoke test.",
        );
        return;
      }

      console.log("[TEST] Waiting for canvas and HUD...");
      await page.waitForSelector("#lens-canvas", { timeout: 5000 });
      await page.waitForSelector("#stat-fps-value", { timeout: 5000 });

      // Let the simulation run for a bit
      await new Promise((r) => setTimeout(r, 2000));

      // Check if FPS populated
      const fpsText = await page.$eval(
        "#stat-fps-value",
        (el) => el.textContent,
      );
      console.log(`[TEST] Current FPS: ${fpsText}`);
      assert(fpsText !== "—" && parseInt(fpsText!) > 0, "FPS should be > 0");

      // Check Mode Parity
      const parityText = await page.$eval(
        "#stat-mode-value",
        (el) => el.textContent,
      );
      assertEquals(
        parityText,
        "TOROIDAL",
        "Museum should boot in Toroidal parity mode",
      );

      // Test Pause
      await page.keyboard.press(" ");
      const pausedDisplay = await page.$eval(
        "#paused-overlay",
        (el) => getComputedStyle(el).display,
      );
      assertEquals(pausedDisplay, "flex", "Paused overlay should be visible");

      console.log("✅ [TEST] Museum Smoke Test Passed.");
    } finally {
      await browser.close();
    }
  },
});
