# AgriVerse — Plot Intelligence (November 14, 2026)

## Where to find it
Farmer → choose island → Find your place → draw/confirm farm boundary → choose crop strategy → **Made for your land** → **Plot details**.

The crop cards remain clickable and open Farm Intelligence.

## What works now
- Reads the existing drawn polygon and its estimated area. It never infers exact soil chemistry from an aerial image.
- Uses the existing NASA POWER **2025 historical annual mean air temperature**, when successfully loaded.
- Accepts farmer-provided elevation, slope, soil texture, drainage, soil pH (with evidence source), irrigation type, dry-season water reliability, and qualitative N/P/K information.
- Compares available historical air temperature and **measured** pH (lab or field kit) against the six published FAO ECOCROP ranges already in the project. Unverified pH estimates are displayed but not used to rank crops.
- Orders the six sourced candidates by fewest failed checks, most passed checks, then fewer broad agronomic cautions. Ties are resolved alphabetically. This is a **preliminary screening order**, not a calibrated crop suitability percentage or yield forecast.
- Flags general considerations (steep slopes, drainage, rice with limited water, unreliable dry-season water, reported low nutrient status) without pretending to have validated crop-specific thresholds.
- Resets plot-profile inputs when the drawn boundary changes; exports entered profile and screening evidence in the farm-plan JSON.

## Not implemented yet
- Automatic elevation/slope extraction from NASA SRTM or Copernicus DEM.
- Validated field-specific soil texture/pH/nutrient maps. SoilGrids is gridded and cannot substitute for a soil lab test. Available phosphorus and potassium generally require soil tests.
- Field-level water volume, irrigation sustainability, SMAP farm measurements, crop-specific water budget, actual planting dates, and soil nutrient requirement calculations.
- Verified multi-factor suitability scores for all 98 crops. Only the six existing sourced ecology profiles are used for preliminary screening; the remaining 92 remain educational entries.
- Real-time hazard or soil-moisture alerts.

## How to connect future GIS data
The boundary polygon is already stored as latitude/longitude points in the existing application state. A future server endpoint should accept the polygon as GeoJSON and return a structured object with, for **every field**, `value`, `unit`, `source`, `observed_at` or `dataset_version`, `spatial_resolution`, `method`, and `quality_flag`.

Recommended sequence:
1. Extract elevation/slope across the polygon from a DEM, reporting distribution (e.g., median, range), not just one centroid pixel.
2. Obtain local soil survey / soil lab data. Use coarse gridded soil products as *regional estimates* with spatial-resolution warnings.
3. Combine NASA POWER historical weather, seasonal water balance, farmer irrigation access, and field observations.
4. Curate crop-specific terrain, water, soil, phenology, nutrient, and rotation thresholds with agronomist review.
5. Validate ranking against local trials before calling results recommended planting decisions.

## Files changed
- `index.html`: a new Plot Intelligence section in Screen 05, crop-card evidence, data export, and script/style references.
- `assets/plot-recommender.js`: field-profile form, provenance checks, ranking, and caution flags.
- `assets/plot-recommender.css`: compact mint liquid-glass styling.

## Scientific interpretation
- NASA POWER 2025 is historical gridded context, not a farm sensor or current live weather.
- FAO ECOCROP optimal annual temperature and pH ranges are *screening ranges*, not a guarantee of performance.
- Annual ecological rainfall range must **not** be confused with crop-cycle irrigation demand.
- Slope ≥15% is a general erosion-assessment caution in this prototype, **not** a crop-specific exclusion rule.
- Soil nutrient labels are user-provided categories and are **not** a fertilizer recommendation.
- Simulated boundaries remain simulated and must not be treated as verified farm plots.
