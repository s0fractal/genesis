import puppeteer from "npm:puppeteer";

const browser = await puppeteer.launch();
const page = await browser.newPage();

page.on("console", (msg) => {
  if (msg.type() === "error") {
    console.log("ERROR:", msg.text());
  } else {
    console.log("LOG:", msg.text());
  }
});
page.on("pageerror", (err) => {
  console.log("PAGE_ERROR:", err.message);
});

await page.goto("http://127.0.0.1:5174/", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 2000));
await browser.close();
