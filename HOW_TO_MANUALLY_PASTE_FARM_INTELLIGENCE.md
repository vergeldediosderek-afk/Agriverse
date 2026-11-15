# AgriVerse — Farm Intelligence Dashboard (manual copy-and-paste)

## Which project does this code match?

This update was built against **AgriVerse_Location_Liquid_Glass_Redesign.zip** (with a single integrated `index.html`, `server.py`, and `assets/location-redesign.css` + `location-redesign.js`). It preserves the existing animations, location redesign, Python backend, CropPedia, and Excel file.

## Easiest manual copy-and-paste (3 files)

1. In VS Code, open your existing `AgriVerse` project folder, which should include `index.html`, `server.py`, and `assets/`.
2. **Backup** your existing `index.html`: copy and rename it to `index.backup.html`.
3. Open the supplied `index.html` from this update in VS Code. Press **Ctrl+A, Ctrl+C**. Open **your original project's `index.html`**, press **Ctrl+A, Ctrl+V**, and save with **Ctrl+S**.
4. In your project's `assets/` folder, create **`farm-intelligence.css`**; copy the entire supplied `assets/farm-intelligence.css` file into it; save.
5. In `assets/`, create **`farm-intelligence.js`**; copy the entire supplied `assets/farm-intelligence.js` into it; save.
6. **Do not delete** `location-redesign.css`, `location-redesign.js`, the existing Excel workbook, `catalog.json`, or `server.py`.
7. In VS Code terminal, run `python server.py` from the project folder. Open `http://localhost:8899` and press **Ctrl+F5**.

You can also use the provided *complete project ZIP* instead of manually copying files, but that is optional.

## Flow to test

1. Farmer → Mindanao → province/city/barangay → identify and draw the farm polygon → confirm.
2. Select **One crop** or **Crop rotation**, then Analyze my farm.
3. Tap a **crop card** or **rotation plan card**. This opens **Farm Intelligence**.
4. See the drawn farm area and map in the middle; farm profile and hazard-preparedness panels on the left; CropPedia and editable profit estimator on the right.
5. For rotation, tap a crop icon to switch CropPedia details; enter expected yield, farmgate price, variable costs, and extra fixed costs **for every season**.
6. Tap **Continue to plan summary**. The original plan-summary fields and calculated total carry forward.

## Correctness guardrails

- The center map is the **user-drawn polygon on aerial imagery**, not a new satellite measurement.
- Farmer-reported soil type and access to irrigation are **not** measured soil texture, water levels, or NASA SMAP soil moisture.
- NASA POWER values are historic **2025 gridded** air temperature and rainfall when retrieval succeeds. They are not field sensor readings, forecasts, or verified crop yields.
- Hazard cards describe preparedness for possible heavy rain/flooding, heat/drought, and storms. **They are not live forecasts or farm-specific hazard risk scores.** Check official PAGASA warnings.
- Six CropPedia crop profiles have FAO ECOCROP ecological references; the other 92 library items remain educational/unverified in the current data set.
- Wikipedia crop photos depend on internet access; the crop emoji remains visible without them.
- Profit is calculated only after you supply data. Farmgate prices and yields are never auto-filled.

## Profit formula

For each growing season:

- Revenue = Area (ha) × Expected yield (tonnes/ha) × 1000 (kg/tonne) × Farmgate price (₱/kg)
- Variable costs = Area (ha) × Entered cost (₱/ha)
- Season net return = Revenue − Variable costs − Any additional fixed costs (₱ for that season)

For a rotation, add the net returns of all successive seasons. The screen labels this as a **multi-season total**, not a single-season or annual profit figure. The scenario row uses 75% of entered yield at the same price and cost (a sensitivity check, not a forecast).

**Example**: 1 ha; 4 tonnes/ha; ₱20/kg; ₱35,000 variable cost/ha; ₱5,000 extra fixed cost → revenue ₱80,000, total costs ₱40,000, estimated net return ₱40,000. Include labor, seed, fertilizer, harvesting, transport, rented equipment, land rent, finance charges and other real expenses as applicable. Unentered costs make the estimate too optimistic.

## If you have changed the original index.html independently

Do not overwrite your custom work blindly. Open the supplied old and new `index.html` files side by side in VS Code and compare before pasting. Most changes are to the embedded app script: adding `farm-intelligence` to journey navigation; invoking `AVFarm.open()` with the existing `state`; opening the new screen when a crop or rotation is selected; and syncing the financial results back to the original summary. The new CSS/JS files by themselves are insufficient unless the new `index.html` integration is also copied.

## Verified / pending

Local tests: page assets served by Python; UI transitions from crop selection and rotation selection; one-crop and three-season calculations; transfer to the existing plan-summary total; JS reports no runtime exceptions in local simulated tests; mobile layout rendered. Live NASA calls, online aerial tiles, actual Wikipedia images, and live PAGASA/SMAP integrations have **not** been verified here.
