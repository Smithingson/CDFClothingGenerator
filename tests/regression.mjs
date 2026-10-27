// Regression run: drives a served copy of the site through representative outfits and saves
// every export (template PNGs, showcase PNGs, layer ZIPs) plus what the page shows (ticks, warnings, counts).
// Run it against two builds and compare the output folders with tests/compare_runs.py.
//
//   node tests/regression.mjs http://localhost:8765/ out/base
//   PLAYWRIGHT=/path/to/playwright/index.mjs node tests/regression.mjs ...   (if playwright isn't resolvable)
//
// The site needs uploads.json + uploads/ next to it (the Drive items), e.g. copied from the live site.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
const [url, outRoot] = process.argv.slice(2);
if (!url || !outRoot) { console.error("usage: node tests/regression.mjs <site url> <output dir>"); process.exit(2); }
const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const RED = path.join(fixtures, "red-torso.png"), BLUE = path.join(fixtures, "blue-square.png");

const browser = await chromium.launch();

async function open() {
  const p = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  p.errors = [];
  p.on("pageerror", e => p.errors.push(e.message));
  await p.goto(url);
  await ready(p);
  return p;
}
const ready = p => p.waitForFunction(() => !document.getElementById("save").disabled, null, { timeout: 30000 });
const garment = async (p, f) => { await p.click(`#tab-${f}`); await ready(p); };
const branch = async (p, b) => { await p.click(`[data-branch="${b}"]`); await p.waitForTimeout(100); };

// Tick or untick the item with this label in this section (nth match when a section repeats a label, e.g. "None").
async function pick(p, section, label, check = true, nth = 0) {
  const found = await p.evaluate(([section, label, nth]) => {
    let k = 0;
    for (const sec of document.querySelectorAll(".sec")) {
      if (sec.querySelector("h2").textContent.trim().toLowerCase() !== section.toLowerCase()) continue;
      for (const row of sec.querySelectorAll(".row")) {
        const b = row.querySelector(".lbl b");
        if (b && b.textContent.trim() === label && k++ === nth) { row.querySelector("input").dataset.t = "1"; return true; }
      }
    }
    return false;
  }, [section, label, nth]);
  if (!found) throw new Error(`No item "${label}" in section "${section}"`);
  const input = p.locator('[data-t="1"]');
  if (check) await input.first().check(); else await input.first().uncheck();
  await p.evaluate(() => document.querySelectorAll("[data-t]").forEach(e => e.removeAttribute("data-t")));
}

const ui = p => p.evaluate(() => {
  const $ = id => document.getElementById(id);
  return {
    warn: $("warn").hidden ? "" : $("warn").textContent.trim(),
    msg: $("msg").hidden ? "" : $("msg").textContent.trim(),
    count: $("count").textContent.trim(),
    checked: [...document.querySelectorAll(".sec")].flatMap(sec => [...sec.querySelectorAll(".row")]
      .filter(r => r.querySelector("input").checked)
      .map(r => `${sec.querySelector("h2").textContent.trim()} / ${r.querySelector(".lbl b").textContent.trim()}`)),
    sections: [...document.querySelectorAll(".sec")].map(s => `${s.querySelector("h2").textContent.trim()}: ${s.querySelector(".n").textContent.trim()}`),
    customOrder: [...document.querySelectorAll(".order")].map(o => o.textContent.replace(/[▲▼]/g, "").trim()),
  };
});

async function run(name, steps) {
  const dir = path.join(outRoot, name);
  fs.mkdirSync(dir, { recursive: true });
  const record = { states: {}, downloads: {} };
  const p = await open();
  const ctx = {
    p,
    snap: async key => { record.states[key] = await ui(p); },
    dl: async (selector, file) => {
      const [d] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), p.click(selector)]);
      await d.saveAs(path.join(dir, file));
      record.downloads[file] = d.suggestedFilename();
    },
  };
  try { await steps(ctx); } catch (e) { record.error = String(e); }
  record.errors = p.errors;
  fs.writeFileSync(path.join(dir, "record.json"), JSON.stringify(record, null, 2));
  await p.close();
  console.log(name, record.error ? `FAILED: ${record.error}` : "ok", p.errors.length ? p.errors : "");
}

const both = async (c, tag) => {
  for (const f of ["shirt", "pants"]) {
    await garment(c.p, f);
    await c.snap(`${tag}-${f}`);
    await c.dl("#save", `${tag}-${f}.png`);
  }
};

await run("start", c => both(c, "start"));

await run("shirt-picks", async c => {
  await pick(c.p, "UNDERSHIRTS", "T-Shirt (Black)");
  await pick(c.p, "BUTTON UPS AND BANDANAS", "Western Shirt (Red)");
  await pick(c.p, "BUTTON UPS AND BANDANAS", "Button Up 1 Bandana");
  await pick(c.p, "ALICE RIG + POUCHES", "ALICE Belt");
  await pick(c.p, "ALICE RIG + POUCHES", "LOADOUT #3");
  await pick(c.p, "GEAR", "Bandolier (Olive)");
  await pick(c.p, "GEAR", "Canteen");
  await c.snap("picks");
  await c.dl("#save", "picks-shirt.png");
  await c.dl("#save-layers", "picks-shirt-layers.zip");
  await pick(c.p, "BUTTON UPS AND BANDANAS", "Rolled Western Shirt (Red)");   // replaces the unrolled one
  await pick(c.p, "GEAR", "None", true, 1);
  await c.snap("swapped");
  await c.dl("#save", "swapped-shirt.png");
});

await run("pants-picks", async c => {
  await garment(c.p, "pants");
  await pick(c.p, "FOOTWEAR", "Combat Boots (Brown)");
  await pick(c.p, "GAITERS", "Gaiters (Black)");
  await pick(c.p, "PANTS", "Slacks (Grey)");
  await pick(c.p, "PANTS", "Optional Black Belt if that's what you're into (FOR SLACKS)");
  await pick(c.p, "DROPDOWNS", "Lab Coat");
  await c.snap("pants");
  await c.dl("#save", "pants.png");
  await c.dl("#save-layers", "pants-layers.zip");
});

await run("custom-layers", async c => {
  await pick(c.p, "UNDERSHIRTS", "Undershirt (Grey)");
  await pick(c.p, "BUTTON UPS AND BANDANAS", "Button Up 2 (Turnip)");
  await pick(c.p, "ALICE RIG + POUCHES", "Suspenders");
  await c.p.setInputFiles("#add-shirt", [RED, BLUE]);
  await c.p.waitForTimeout(300);
  await c.snap("added");
  await c.dl("#save", "added-shirt.png");
  const down = c.p.locator(".order .down");
  const stuck = b => b.evaluate(e => e.disabled || e.getAttribute("aria-disabled") === "true");
  await down.nth(0).click();
  for (let i = 0; i < 40 && !(await stuck(down.nth(1))); i++) await down.nth(1).click();   // red to the bottom
  await c.p.locator(".order .up").nth(1).click();
  await c.snap("moved");
  await c.dl("#save", "moved-shirt.png");
  await c.dl("#save-layers", "moved-shirt-layers.zip");
  await c.p.locator("#mine .remove").nth(1).click();
  await c.snap("removed");
  await c.dl("#save", "removed-shirt.png");
});

await run("clear", async c => {
  await pick(c.p, "UNDERSHIRTS", "Tank Top (Tan)");
  await c.p.click("#clear");
  await c.snap("cleared");
  await c.dl("#save", "cleared-shirt.png");
  await c.p.click("#save-layers");
  await c.p.waitForTimeout(200);
  await c.snap("cleared-zip");
});

await browser.close();
