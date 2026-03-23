import puppeteer from "npm:puppeteer";

async function debugLocalhost() {
    console.log("Opening Chrome wrapper via Puppeteer...");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    page.on("console", (msg) => {
        console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}:`, msg.text());
    });
    
    page.on("pageerror", (err) => {
        console.error(`[BROWSER ERROR]`, err.message);
    });

    console.log("Navigating to http://localhost:5173...");
    try {
        await page.goto("http://localhost:5173", { waitUntil: "networkidle0", timeout: 10000 });
    } catch (e) {
        console.error("Failed to load page:", e.message);
        await browser.close();
        return;
    }

    console.log("Page loaded. Waiting 3 seconds for WebGPU bindings...");
    await new Promise(r => setTimeout(r, 3000));
    
    await browser.close();
    console.log("Debug session closed.");
}

debugLocalhost();
