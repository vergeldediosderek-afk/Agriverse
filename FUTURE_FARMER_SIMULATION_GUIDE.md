# AgriVerse — Future Farmer Simulation (2026-11-14)

## What's new

The **Future Farmer** button on the welcome screen now opens a standalone, playable **three-season educational farming simulation** instead of the real-farm island/location workflow.

- 12 illustrated farm plots that change after planting and harvesting.
- Three fictional weather scenarios: dry spell, heavy rainfall, mild conditions.
- Six crop choices: corn, rice, mung bean, peanut, soybean, cowpea.
- Five management actions: observe, mulch, compost, irrigate, drainage.
- Budget (game credits), soil-health and water-reserve indicators, missions, score, season journal and results/replay.
- Separate Farmer mode remains unchanged.

## Run the full website

1. Extract the ZIP.
2. Open the inner **AgriVerse** folder (the one containing `server.py`).
3. Open a terminal there and run `python server.py`.
4. Open `http://localhost:8899`.
5. Choose **Future Farmer**.

## Manual installation

Back up your existing files first. Copy the complete contents of the updated files into the matching paths:

- `index.html` → `AgriVerse/index.html`
- `assets/future-farmer.css` → `AgriVerse/assets/future-farmer.css`
- `assets/future-farmer.js` → `AgriVerse/assets/future-farmer.js`

The updated `index.html` already references the new CSS and JavaScript. Do not add duplicate tags. Restart your server if needed, then press Ctrl+Shift+R in your browser.

## Science/data disclosure

**The game is a simulation, not a crop suitability tool.** All weather scenarios, water points, soil-health points, yields, budgets, scoring weights and management effects are deliberately illustrative. Credits are not Philippine pesos. The game does not use live NASA data, actual plot measurements or local farmgate prices. These values must never be presented as validated agronomic predictions.

When validated datasets are available, connect them to the real Farmer-mode suitability engine separately. Future Farmer can later add educational scenarios inspired by those datasets, clearly distinguished from observations.

## Testing

- Tested three seasons, mission tracking, crop/action selection, results, replay and return to Farmer mode in a local Chromium test harness.
- Tested desktop 1440×900 and laptop 1366×768 with no document-level scrollbars; on phones the panels stack and the page scrolls for accessibility.
- Existing Python smoke test passes: site serves, 98 crop records, six sourced profiles.
- Browser testing used a locally inlined copy of the page due to sandbox restrictions on local navigation. Test the ZIP on your Windows computer as well.
