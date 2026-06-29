#!/usr/bin/env -S deno run -A
// browser_p2p_test.ts — headless-browser end-to-end test of the browser path
// (chord x3300_955983). Launches Chromium (astral), opens the P2P page in two
// pages, joins the same room, and asserts they connect DIRECTLY (WebRTC) and
// that a signed chord flows browser↔browser and verifies VALID. This is how the
// browser path is tested without a human opening tabs.
//
//   deno run -A tools/browser_p2p_test.ts            # against https://relay.myc.md
//   URL=http://127.0.0.1:9091/mesh/p2p deno run -A tools/browser_p2p_test.ts

import { launch } from "jsr:@astral/astral@0.5.2";

const URL = Deno.env.get("URL") ?? "https://relay.myc.md/mesh/p2p";
const ROOM = "bt" + Math.floor(performance.now()) +
  Math.floor(performance.timeOrigin % 1000);

const browser = await launch({ headless: true, args: ["--no-sandbox"] });
// deno-lint-ignore no-explicit-any
async function open(room: string): Promise<any> {
  const page = await browser.newPage(URL);
  await new Promise((r) => setTimeout(r, 800));
  await page.evaluate((rm: string) => {
    (document.getElementById("room") as HTMLInputElement).value = rm;
    (document.getElementById("join") as HTMLButtonElement).click();
  }, { args: [room] });
  return page;
}

try {
  const a = await open(ROOM);
  await new Promise((r) => setTimeout(r, 1500)); // A waits, then B offers
  const b = await open(ROOM);

  let connected = false;
  for (let i = 0; i < 8 && !connected; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const sa = await a.evaluate(() =>
      document.getElementById("status")!.textContent
    );
    if (String(sa).includes("DIRECT")) connected = true;
  }
  if (!connected) throw new Error("peers did not connect directly (WebRTC)");

  await a.evaluate(() =>
    (document.getElementById("send") as HTMLButtonElement).click()
  );
  let verdict = "";
  for (let i = 0; i < 8 && !verdict; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    verdict = String(
      await b.evaluate(() => document.getElementById("verdict")!.textContent) ??
        "",
    );
  }
  if (!verdict.includes("VALID")) {
    throw new Error(`chord not verified VALID over P2P: "${verdict}"`);
  }

  console.log(
    `✅ browser path P2P OK — connected directly + chord verified VALID over WebRTC\n   ${verdict}`,
  );
  await browser.close();
  Deno.exit(0);
} catch (e) {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  await browser.close();
  Deno.exit(1);
}
