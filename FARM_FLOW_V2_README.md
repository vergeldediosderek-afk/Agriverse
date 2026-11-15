# AgriVerse — Updated Farmer Journey (Nov 14, 2026)

This update fixes the previously hidden **Find approximate location** button and changes the unified farm screen into a progressive journey:

1. **Choose your place:** Province → City/Municipality → Barangay → Purok/Sitio. Optionally click **Find approximate location**. This uses a public map search and falls back to broader areas if Purok/Sitio is not mapped. This DOES NOT determine exact farm boundaries.
2. **Draw the real farm:** Zoom and click at least three corners. Confirm using the existing boundary dialog.
3. **Choose crop mode:** A right-side widget offers **Single Crop** and **Crop Rotation**.
4. **Review the farm:** The same widget transforms into a compact land-specification dashboard. Area is computed from polygon coordinates; terrain and soil nutrients display explicit missing-data labels. Soil texture, water access, and farming priorities are user-supplied.
5. **See crop recommendations:** A preliminary top banner appears after crop mode selection. The three sample crop chips are examples, NOT farm-specific validated recommendations. The button takes the farmer directly to the existing crop screening page (skipping the redundant old planting strategy page), from which a selected crop opens Farm Intelligence.

## Installation on Windows
Extract the zip. Open the inner `AgriVerse` directory containing `server.py` in VS Code. Run `python server.py`, then visit `http://localhost:8899`. Keep the terminal open. Press Ctrl+Shift+R to refresh cached files.

## Manual patch
From the manual patch ZIP, copy:
- `index.html` → `AgriVerse/index.html`
- `assets/combined-journey.js` → `AgriVerse/assets/combined-journey.js`
- `assets/combined-flow-v2.css` → `AgriVerse/assets/combined-flow-v2.css` (new)

Back up your existing `index.html` and `combined-journey.js` before replacing them. The modified `index.html` already loads the new CSS file.

## Accuracy / limits
The Purok/Sitio name may have no indexed coordinates; a public address search can only provide approximate starting points. The true plot is determined by user-drawn corners. NASA recent weather and SMAP, crop nutrient, terrain and detailed water layers are NOT integrated by this patch. The crop candidates shown above the farm should not be represented as verified rankings. External map tile and geocoding success depend on internet and provider availability.

## Validation
- HTML has exactly one approximate-location button and status label.
- JavaScript syntax and a browser-based DOM interaction test passed (the preview test uses a simulated offline map).
- Python backend smoke test passed: local server, 98-record catalog, 98-record Excel import / 6 sourced entries.
- Real external map imagery and geocoding not verified in testing.
