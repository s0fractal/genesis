// deno-lint-ignore-file
import { chromium } from "npm:playwright";

async function run() {
    const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu"] });
    const page = await browser.newPage();
    
    page.on("console", msg => {
        const text = msg.text();
        if (text.includes("error") || text.includes("warning") || text.includes("Error") || text.includes("Invalid")) {
            console.log("BROWSER LOG:", text);
        }
    });

    console.log("Navigating to local phase...");
    await page.goto("http://localhost:5173/?mode=phase");
    
    console.log("Waiting 3s...");
    await new Promise(r => setTimeout(r, 3000));
    
    await browser.close();
}

run();
