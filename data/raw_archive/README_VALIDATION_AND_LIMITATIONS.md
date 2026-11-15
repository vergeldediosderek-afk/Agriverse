# AgriVerse | ISRIC SoilGrids 2.0 | Valencia City — Raster validation

## RESULT: STRUCTURAL PASS, NITROGEN CONDITIONAL

Input: `AgriVerse_SoilGrids_Valencia_250m_55Bands.tif` (untouched copy in this ZIP).

- Bands: **55** = **9 soil properties × 6 depth intervals + 1 surface pH validity band**.
- CRS **EPSG:32651**, nominal **250 m** grid, **195 columns × 125 rows**.
- **24,017 / 24,375 pixels (98.5313%)** contain all 54 property/depth values.
- **31/31** reference points inside raster and all 54 soil values present at each.
- **31/31** points in different 250 m pixels. These are reference points, not representative averages of entire barangays or precise farm measurements.
- At every soil depth, soil sand/silt/clay percentages sum within ~0.1 percentage point of 100% (rounding).
- Soil pH (0–5 cm) ranges 5.0–5.9 over the raster.
- Nodata = **-9999** in the original raster; different soil-property layers have slightly different nodata masks. The provided validity band describes pH only, NOT all 54 properties. An extra strict all-54 mask is supplied.

### IMPORTANT SCIENTIFIC FLAG: exported total nitrogen

The original exported surface `total_nitrogen_g_kg_0_5cm` is **37.37 g/kg median**, while exported surface soil organic carbon is **52.50 g/kg median**. Their median SOC:N ratio is **1.43**, unusually low for many mineral soils. **All valid surface nitrogen pixels exceed 15 g/kg in this extract.**

ISRIC metadata states SoilGrids total nitrogen stored unit cg/kg should be divided by 100 for g/kg; that divisor was applied in the original GEE script. Nevertheless, the surprising result means **DO NOT use the total-nitrogen layer for fertilizer advice, nutrient ranking, or crop suitability until independently verified** against an authoritative SoilGrids raster/point service and local soil data. We have NOT guessed a replacement scale, changed the nitrogen data, or confirmed that it is a genuine high value versus extraction / source issue.

The `SoilGrids_31_Barangays_Safe_Surface_Preview.csv` purposefully leaves its N-for-scoring field empty. The full 54-band raw samples and original TIF preserve the exported numbers, clearly flagged.

### Contents

- `ORIGINAL_SoilGrids_Valencia_250m_55Bands.tif`: original unchanged raster.
- `SoilGrids_31_Barangay_Full_54_Properties_RAW.csv`: 31-point complete data with provenance; **N unverified**.
- `SoilGrids_31_Barangays_Safe_Surface_Preview.csv`: 0–5 cm preview fields; N excluded for scoring.
- `SoilGrids_Raster_55_Band_Statistics.csv`: missing/valid pixel count and min, median, max of each band.
- `SoilGrids_SandSiltClay_Composition_Audit.csv`: texture percentage sum validation for all six depths.
- `SoilGrids_All54_Properties_Available_Mask.tif`: 1 if all 54 property bands are present, otherwise 0.
- `SoilGrids_Audit_Metrics.json`: audit summary.

### Scientific limitations

- SoilGrids is a **model-derived estimated soil dataset**, not laboratory sampling; at nominal 250 m, a selected farm may not reflect the value precisely.
- N (total N) ≠ nitrogen currently available to plants. pH, SOC and texture are also uncertain; P and K are not included.
- SoilGrids on Earth Engine offers mean prediction images; prediction intervals are not in the supplied 55-band raster.
- Region is rectangle around 31 reference points, not official Valencia City boundary or every Philippine farm.
- For farm-specific crop advice, require polygon clipping, quality flags, and ideally measured pH / soil test.

Sources checked: https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html and https://docs.isric.org/globaldata/soilgrids/access_on_gee.html.
