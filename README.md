# AgriVerse — Cinematic & Liquid Glass Edition

**Windows-ready local package (November 11, 2026)**

This archive restores the **Python server**, the **Excel crop workbook**, the **98-plant JSON catalog**, and the latest available integrated **cinematic/liquid-glass frontend**. The frontend is a **single `index.html` file** with its app JavaScript and CSS embedded. You do not need separate `app.js` and `style.css` files for this edition.

## Launch on Windows

1. Right-click the ZIP and choose **Extract All**.
2. Open the extracted **AgriVerse** directory (the directory with `server.py`).
3. Double-click **`RUN_AGRIVERSE.bat`** (or `START_AGRIVERSE.bat`), or open PowerShell there and enter `python server.py`.
4. In your browser, open **http://localhost:8899**.
5. Keep the terminal/window open while using the website. Press **Ctrl+C** to stop.

**Python 3.10+** is required. This project has **no Python package requirements**, so there is no `pip install` step. `requirements.txt` is included only to prevent confusion. If your browser reports an unavailable page, check that the server console says `AgriVerse local server: http://localhost:8899` and that another process is not already using port 8899.

## Package contents

- `index.html` — integrated website, responsive styling, animations, crop and farm planning UI.
- `server.py` — local Python web server, NASA POWER proxy and Excel catalog-import API.
- `catalog.json` — 98 plant catalog entries with clear sourcing status.
- `AgriVerse_Verified_Crop_NASA_Integration.xlsx` — Excel crop database (98 entries, six sourced ecology profiles).
- `requirements.txt` — documents that there are no third-party Python packages.
- `RUN_AGRIVERSE.bat` — one-click Windows launcher (also aliased as `START_AGRIVERSE.bat`).
- `tests/smoke_test.py` — local integration test, run with `python tests/smoke_test.py` while the server is running.

## Current scientific and technical scope

- **NASA POWER**: the backend requests real daily historical data for **2020–2025** at a coordinate derived from the user's **drawn farm boundary**. It compares 2025 to a 2020–2024 baseline, and requires month-level completeness. This is **historical, gridded climate context**, not farm-scale weather sensors, a real-time forecast, or a guarantee of crop suitability. Internet access is required.
- **Location**: the province/city/barangay selectors are for navigation/context. They cannot identify a farm. The farmer must select/draw and check a genuine boundary. An automatically generated outline is **simulated** until edited and verified by the farmer.
- **CropPedia**: 98 plant names are available; only **six** include sourced FAO ECOCROP ecology ranges. Unverified entries are educational and must not be treated as validated recommendations.
- **Finances**: cost, yield and farmgate price scenarios require user assumptions. No authoritative local prices, crop yield prediction, or guaranteed profits are provided.
- **Not integrated**: NASA SMAP soil-moisture measurements, MODIS products, live PAGASA warnings, ground-truth soil tests, or validated individual-farm recommendations.
- **Internet**: the interactive Leaflet map requires its CDN JavaScript/CSS and external map imagery. Geocoding and optional Wikipedia crop photos also depend on external services. NASA API needs internet. Fonts may fall back when offline.

## Troubleshooting

- `Python was not found`: install Python 3.10+, close/reopen VS Code and run `python --version`.
- `Could not open requirements.txt`: ensure you're in the extracted **AgriVerse** folder; installing from requirements is **not necessary** here.
- `Address already in use`: close the previous AgriVerse server (Ctrl+C) before launching again.
- `NO NASA` or unavailable climate data: confirm internet access; the code does **not** invent NASA values when upstream is down. See the browser console and local server terminal.
- Map tiles missing: check internet connectivity and browser content blockers; map imagery depends on an external server.
- If you previously extracted a frontend-only ZIP with `app.js` and `style.css`, **use this extracted folder instead of mixing the two versions**.

## Sources

- [NASA POWER official Daily API documentation](https://power.larc.nasa.gov/docs/services/api/temporal/daily/)
- [NASA POWER portal](https://power.larc.nasa.gov/)
- [FAO ECOCROP](https://ecocrop.apps.fao.org/ecocrop/)

**Prototype note:** This is a local project-pitch prototype, not a public production deployment or validated agronomic advisory service.
