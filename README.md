# CDF Uniform Generator

Pick shirt and pants layers for the Civil Defense Front uniform, preview the template live, and download the finished PNGs for Roblox.

Site: https://smithingson.github.io/CDFClothingGenerator/

Artwork by Shrugly · Formatted by Smithingson

## Your own PNGs (for players)

Players can press **Add PNG** under "Custom Shirt Layers" or "Custom Pants Layers" to layer their own 585×559 PNGs on top of the generator items. The ▲ ▼ arrows move a PNG up or down one layer at a time. The files stay in their browser, are never uploaded, and clear on reload.

**Download layers** saves the ticked items (not the frame) as a .zip of full 585×559 PNGs, numbered from the bottom layer (01) up, in the same format the Drive folder and Add PNG accept.

## Adding items (for clothing creators)

Drop PNGs into the shared Google Drive folder **CDF Uniform Generator Uploads**. The site picks them up within an hour.

```
CDF Uniform Generator Uploads/
  Shirt/
    GEAR/
      Bandolier (Red).png      ← appears as "Bandolier (Red)"
  Pants/
    ...
```

- **One item per PNG**, exactly **585×559** (the Roblox template), transparent everywhere except the item, just like a layer in the .pdn generator.
- **File name = item name.** Tags in square brackets show as badges, e.g. `Canteen [Green].png`.
- **Folder = section.** Put files in Shirt or Pants, then a section folder. A new section folder creates a new section.
- New items appear **on top of their section** and start unticked.
- Under 5 MB, and no two files with the same name in one section.
- To remove an item, delete the file from Drive. To update one, replace the file, keeping the same name.
- The original items live in these folders too. If Drive returns no items at all, the update stops and the site keeps its last version. Their stacking order and choose-one groups are remembered by name in `data/layout.json`, so renaming an original makes it a new, ungrouped item on top of its section.

Files that break a rule are skipped. The reason is listed in the latest run under the repo's **Actions** tab.

## How it updates

`.github/workflows/pages.yml` runs every hour, on every push to `main`, and on demand (Actions → Build and deploy site → Run workflow). It runs the tests, copies the site, runs `scripts/sync_drive.py` to pull and check the Drive PNGs into `uploads/` + `uploads.json`, and deploys to GitHub Pages.

## How the code is organised

A static site with no build step and one outside library (JSZip, for the layers .zip). It shares its code with the Larovan Uniform Generator.

| Where | What |
| --- | --- |
| `data/branches.json` | The uniform: name and slug. One entry means no branch buttons and Shirt/Pants directly in the Drive folder. |
| `data/layout.json` | Sections from the bottom of the stack up, each item's name, choose-one `group` and `default`. |
| `assets/cdf/` | `shirt-frame.png` and `pants-frame.png`. |
| `assets/site/` | Logo, red edge textures and (once added) the Loser Moto Club font. |
| `js/catalog.js` | Builds the item list from the layout plus `uploads.json`, and reads badges and rules from item names. |
| `js/outfit.js` | What's ticked, defaults, Clear all, your own PNGs, and the drawing order (`stack`). |
| `js/rules.js` | "Do not use with / without" warnings. |
| `js/render.js` | Drawing the template, and the PNG and .zip downloads. |
| `js/ui.js`, `js/main.js` | The interface pieces, and the page controller that connects everything. |

**Layer order** (bottom to top): ticked items, first section at the bottom, with your own PNGs placed just above the item they were moved onto (on top by default), then the frame.

## Tests

- `npm test` checks the catalog, layer order, rules and the Drive file checks. The deploy runs it.
- `tests/regression.mjs` drives a served copy of the site through representative outfits and saves every download; `tests/compare_runs.py` compares two runs pixel by pixel. Steps (Node.js 20+, Python 3 with Pillow):

```
npm install --no-save playwright && npx playwright install chromium
node tests/fetch_uploads.mjs                      # copies the Drive items from the live site
python -m http.server 8000                        # in a second terminal: serves this folder
node tests/regression.mjs https://smithingson.github.io/CDFClothingGenerator/ out/live
node tests/regression.mjs http://localhost:8000/ out/local
python tests/compare_runs.py out/live out/local
```

## One-time setup

1. **GitHub secret:** repo → Settings → Secrets and variables → Actions → New repository secret. Name: `GDRIVE_SA_KEY`. Value: the same service-account `.json` key used for the Larovan generator.
2. **Pages source:** repo → Settings → Pages → Source: **GitHub Actions**.
3. **Test:** Actions → Build and deploy site → Run workflow. The run summary lists what was added or skipped.

The Drive folder is already shared with the service account. Give creators **Editor** access to it; anything they add goes live automatically, so share it only with people you trust.

Note: GitHub pauses scheduled runs in a repo with no commits for 60 days. If uploads stop appearing, re-enable the workflow from the Actions tab.
