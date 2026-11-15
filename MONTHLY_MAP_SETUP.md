# AgriVerse — Monthly Farm Map, Roads, and Farmgate Prices

This is a **future-ready interface**, not a claim that 12 dated satellite images are already available. It extends Farm Intelligence without changing the existing Python server.

## What's available now

- January–December selector and year picker, plus previous/next-month controls.
- Interactive map with **Aerial** (Esri reference basemap), **Roads** (OpenStreetMap reference), and **Monthly image** modes when valid imagery is supplied.
- The user's saved polygon stays visible over mapped imagery; an offline schematic is shown if map tiles are unavailable.
- Monthly NASA POWER rainfall and number of rainy days (daily precipitation >= 1 mm) for 2020–2025 when the existing NASA API request succeeds; observations are gridded, not a field rain gauge.
- Import of actual dated monthly vegetation/imagery records from JSON, or load them from `assets/monthly-observations.json`.
- Farmer-entered road distance and transport cost; no automatic routing or road-accessibility guarantee.
- Farmgate price in **PHP/kg** or **PHP/load**, with explicit kg/load conversion, transport trips, and multi-season profit calculation.

## Installing into an existing AgriVerse folder

Back up your existing files first. Copy these updated files to their matching locations:

1. `index.html` (replace existing)
2. `assets/farm-intelligence.js` (replace existing)
3. `assets/monthly-explorer.js` (new)
4. `assets/monthly-explorer.css` (new)
5. `assets/monthly-observations.json` (new)

Leave `server.py`, `catalog.json`, the Excel database, and other `assets` files untouched. The updated `index.html` already links to both new assets.

Launch: open the **inner `AgriVerse` folder containing `server.py`**, run `python server.py`, then visit http://localhost:8899 and hard-refresh with Ctrl+Shift+R.

## Monthly observation JSON contract

The file must contain `"schema":"agriverse-monthly-v1"` and a `records` array. For each record, provide:

- `year`: observation year, e.g. `2025`.
- `month`: 1–12.
- `farm_bounds`: `[[south_lat,west_lon],[north_lat,east_lon]]`, covering the selected farm centroid. Prevents showing another farm's data.
- Optional `ndvi`: `{ "mean": 0.65, "source": "actual dataset and processing reference", "period": "2025-01" }`. Use an actual measured/processed value; NDVI alone does not identify corn, sugarcane, or grass.
- Optional `rainfall`: `{ "total_mm": 210, "rainy_days": 12, "source": "actual dataset", "period": "2025-01" }`. Example numbers here describe **the file structure only**, not Valencia measurements. Rainy day means precipitation >= 1 mm/day.
- Optional `imagery`: `{ "url": "assets/monthly/jan2025.png", "bounds": [[south_lat,west_lon],[north_lat,east_lon]], "acquired_on": "2025-01-15", "source": "actual satellite scene and processing", "cloud_cover_pct": 8 }`. Dates must match the selected month and the imagery must be geographically aligned (north-up raster covering the farm). Do not use an arbitrary screenshot as a georeferenced overlay.

For a **real January–December sequence**, obtain cloud-masked monthly Sentinel-2 or Landsat/HLS mosaics from an appropriate Earth-observation processing pipeline. Record observation dates, cloud cover, sensor, resolution, spatial extent, and processing methods. Some months may have no usable clear-sky image: leave them unavailable rather than inventing one. For tiny farms, pixel size and mixed-pixel effects matter.

The current `assets/monthly-observations.json` intentionally contains **zero fabricated observations**. You may edit it with real records or use the dashboard's **Load collected monthly data (.json)** button.

## Data connections for later

- NASA POWER: historical gridded precipitation; monthly totals and rainy-day counts already derived from the existing daily response.
- Sentinel-2 / Landsat / NASA HLS: monthly reflectance imagery and vegetation indices, processed and clipped to the farm boundary.
- OpenStreetMap: visual road network. Actual route distance, road quality, vehicle restrictions, and farm-to-market road availability require verified routing/local data.
- Market price feeds: official date-stamped prices for the actual crop variety and transaction unit, or farmer-entered local buyer quotations. **No current crop price is connected in this version.**

## Profit formulas

For each planting season:

- Harvest (kg) = farm area (ha) × expected yield (tonnes/ha) × 1,000.
- If selling by kilogram: revenue = harvest (kg) × farmgate price (PHP/kg).
- If selling by load: equivalent loads = harvest (kg) ÷ kg per load; revenue = equivalent loads × price (PHP/load). This assumes **proportional payment for partial loads**; revise the contract if the buyer pays differently.
- Truck trips = ceil(harvest kg ÷ truck capacity kg) when transport is modeled.
- Transport expense = truck trips × transport cost (PHP/trip).
- Net return = revenue − variable costs/ha × farm area − additional fixed costs − transport expense.

Each crop in a rotation is calculated separately, then the sequential seasons are summed. The calculator does not forecast yields or market prices; all figures are farmer-provided assumptions. It excludes costs not entered and should not be treated as guaranteed profit.

## Accuracy cautions

The aerial basemap has an unspecified acquisition date; changing months **does not change it**. A dated image overlay appears only when the matching, georeferenced monthly record is provided. The Roads mode shows OSM mapped roads, not certified farm-to-market access. Satellite imagery is not a field sensor or a guaranteed crop-identification method.
