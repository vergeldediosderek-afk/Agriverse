# AgriVerse: island focus border fix and crop recommendation roadmap

## Border fix
The island map uses focusable SVG paths. Some browsers draw a black focus rectangle around these after a click. The `assets/island-focus-fix.css` stylesheet removes that default rectangle **only on the island-selection screen** and retains a soft-mint focus glow for keyboard navigation. `index.html` loads the stylesheet after the existing stylesheets.

## Crop suitability recommendation: future development (not yet implemented)

1. **Farm geometry:** Farmer draws polygon; compute representative coordinates, area, elevation range, and slope distribution. Avoid using barangay averages as plot-level measurements.
2. **Elevation and terrain:** NASA SRTM or Copernicus DEM; derive slope, aspect, potential erosion risk. Check coverage and spatial resolution.
3. **Soil:** ISRIC SoilGrids (texture, pH, organic carbon, total nitrogen, CEC, etc.) plus Philippine/local soil maps. SoilGrids is a modeled, relatively coarse estimate. Field samples/lab tests are needed for actual pH, available P/K and nutrient recommendations.
4. **Water and climate:** NASA POWER historical temperature/rainfall, seasonal precipitation, crop water needs, and farmer-reported irrigation. NASA SMAP surface moisture is too coarse to stand in for plot-level soil-moisture measurement.
5. **Crop requirements:** Validated crop profiles for elevation, soil pH, texture, drainage, growing-season temperature, water demand, maturity, pest/disease susceptibility and rotation family. The current library includes 98 entries but only six sourced profiles; do not automatically treat every entry as fully verified.
6. **Decision logic:** Exclude crops violating hard agronomic constraints, then calculate transparent sub-scores for climate, terrain, soil, water, and rotation. Label missing data and uncertainty; do not silently replace missing field values with precise numbers.
7. **Ranking:** Present top candidates with explanation, limiting factors, confidence and recommended tests/actions. Add financial considerations separately from agronomic suitability.
8. **Validation:** Compare outputs against locally measured field conditions, DA/Bureau of Soils and Water Management guidance, and local agronomists. Validate recommendations and crop yields before operational use.

### Example (illustrative) scoring
Suitability = 0.25 climate + 0.20 soil + 0.20 water + 0.15 terrain + 0.10 crop rotation + 0.10 hazard resilience.
Each component is a documented 0–100 score. Weights are initial assumptions to be calibrated; a crop failing a critical constraint must be rejected regardless of its weighted score.

### Source starting points
- NASA POWER: https://power.larc.nasa.gov/
- NASA Earthdata (SRTM, SMAP): https://www.earthdata.nasa.gov/
- ISRIC SoilGrids: https://soilgrids.org/
- FAO crop water guidance: https://www.fao.org/land-water/databases-and-software/cropwat/en/
- Philippine Bureau of Soils and Water Management: https://www.bswm.da.gov.ph/

**Status:** Island focus CSS fix is implemented. Smart recommendation system is a proposed next phase, not a completed integration.
