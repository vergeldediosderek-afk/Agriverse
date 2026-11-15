# AgriVerse — Actual Flow Fix

This version is based on AgriVerse_UX_Code_Review_Fixed_2026-11-14.zip and corrects the actual interaction behavior in its source, rather than supplying a standalone design mockup.

## Farmer workflow
1. Select Mindanao (or another supported island).
2. Enter province, city, barangay, and Purok/Sitio.
3. Click **Find approximate location & plot**. AgriVerse searches for a nearby location and automatically changes to the interactive farm boundary map. If online searching fails, it uses the available city-level map center when possible. **Use city-level map instead** skips the lookup.
4. The location widget slides away and the map/boundary controls appear. Draw at least three corners, and confirm them (simulated outlines are explicitly identified).
5. Land specifications become visible in the right panel: area, terrain status, nutrient status, farmer-reported soil and water options.
6. Under the specifications, select **Single crop** or **Crop rotation**.
7. In Crop rotation mode, fill in most recent crop, last harvest, any problems, and optionally an earlier crop; then click **Use my crop history**. In Single Crop mode, history is not requested.
8. The top **Smart Crop Discovery** banner slides down and offers **See crop recommendations**, which proceeds into the existing crop screening and Farm Intelligence dashboard.

## Data limitations
- Geocoding yields an approximate map center, not a farm boundary or confirmed location of a Purok/Sitio.
- Terrain, NPK and field-specific moisture are unconnected, shown as missing rather than fabricated.
- The top banner is the *entry point* for existing screening; it does not invent crop rankings.
- This is an educational research prototype and not a guarantee of crop yield, suitability or income.

## Installation
Extract zip and open inner AgriVerse folder. Run `python server.py` and go to http://localhost:8899. Hard-refresh browser.

## Manual patch
1. Back up current index.html and assets/combined-journey.js.
2. Replace them with corresponding copies from the patch.
3. Add assets/actual-flow-fix.css.
4. Verify that index.html includes the stylesheet link near the end of the head.
5. Restart web server or force refresh.

## Validation performed
- JavaScript syntax checks for all JS files and inline scripts.
- ZIP archive integrity and catalog server smoke test (98 crop records).
- Static validation of document IDs and state ordering.
- Automated browser interaction couldn't be completed in this runtime because local browser navigation is restricted; verify manually on your PC.
