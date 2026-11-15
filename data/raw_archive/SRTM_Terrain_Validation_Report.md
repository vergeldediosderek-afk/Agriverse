# AgriVerse — SRTM terrain GeoTIFF validation

**Overall status: usable with corrected nodata encoding.** Validated the uploaded image directly, not a screenshot or filename.

## File facts
- Source: `AgriVerse_SRTM_Valencia_Terrain_30m_3Bands.tif`; NASA/USGS SRTM V3 `USGS/SRTMGL1_003` (elevation survey February 2000).
- Map grid: **EPSG:32651**, 30 x 30 m pixels; 2,022 columns x 1,441 rows.
- Bounding rectangle in UTM meters: (698220.0, 853350.0, 758880.0, 896580.0). This rectangle is **not** the official Valencia City boundary.
- Band 1: elevation (metres), observed range 155–2872.
- Band 2: slope (degrees), observed range 0–74.
- Band 3: aspect (degrees clockwise from north), observed range 0–359.
- Valid pixels per band: 2,880,892/2,913,702 (98.8739%); missing pixels: 32,810. The three bands share the same missing mask.
- All 31 barangay **reference points** had valid raster samples.

## Processing applied
- The original GeoTIFF declared `-9999` as no-data but used floating-point NaN for 32,810 missing cells. These have been converted to `-9999` in `SRTM_Valencia_Terrain_30m_CLEAN.tif` for safer GIS usage, with no infilling or interpolation.
- Added descriptive band names, source metadata, and overview pyramids. Kept native 30 m resolution.
- Sampled the **exported raster** at the original 31 reference coordinates to produce `SRTM_31_Barangay_Reference_Point_Samples_FROM_RASTER.csv`; sampling does not represent barangay polygon averages.

## Scientific limits
- Elevation is a NASA SRTM model, not ground-surveyed farm-level elevation. Slope and aspect are computed terrain derivatives; neither is real-time.
- The SRTM raster covers a buffered rectangular region, including land outside Valencia City. For an exact city/farm extraction, later clip by verified boundary polygons.
- This point CSV is sampled from the **reprojected exported GeoTIFF**. Earth Engine's own `sampleRegions(scale: 30)` might sample a slightly different grid or value, so do not claim numerical identity to the original direct Earth Engine point CSV without comparing them.
- A zero aspect on a perfectly flat surface does not necessarily indicate a north-facing slope; account for low slope in modeling.
- Validation checks structure and plausible value domains, **not comparison with ground survey elevation**.

Official source: https://developers.google.com/earth-engine/datasets/catalog/USGS_SRTMGL1_003
Terrain derivatives: https://developers.google.com/earth-engine/apidocs/ee-terrain-products
