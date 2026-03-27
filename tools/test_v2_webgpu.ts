import puppeteer from 'npm:puppeteer';

(async () => {
    console.log("Launching headless browser to harvest WebGPU validation errors...");
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--enable-unsafe-webgpu']});
    const page = await browser.newPage();
    
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
            console.log(`[${msg.type()}] ${msg.text()}`);
        }
    });
    page.on('pageerror', err => console.log(`[pageerror] ${err.message}`));
    
    await page.goto('http://localhost:5173/?mode=v2');
    
    // Trigger Big Bang
    await page.waitForSelector('#igniteBtn', {timeout: 2000}).catch(() => {});
    await page.click('#igniteBtn').catch(() => {});
    
    await new Promise(r => setTimeout(r, 2000));
    await browser.close();
    console.log("Harvest complete.");
})();
