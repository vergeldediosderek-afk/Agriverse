# AgriVerse — All-Data Package and Manual Validation

This ZIP includes the existing website, integrated preliminary recommendation engine, all unique source dataset files retrieved during this integration from the shared Google Drive, and a manual-review page.

**To launch:** On Windows, extract the ZIP, open the AgriVerse folder, double-click `RUN_AGRIVERSE.bat`, then open `http://localhost:8899`. Click **Validate Data** at the bottom of the website or open `http://localhost:8899/manual-validation.html`.

## How to validate
1. Select a field, barangay and/or crop.
2. Enter the value you verified, plus its source and the reviewer.
3. Set status to **Pending**, **Approved**, or **Rejected**.
4. Click **Save validation entry**. Approved supported measurements and approved crop-specific planting months affect the recommendations. Pending and rejected values do not. Dataset-file reviews and narrative notes are recorded but not automatically interpreted as agronomic data.
5. Open AgriVerse and rerun analysis after approval.

**Important:** This is a localhost educational prototype, not an authenticated multi-user validation system. Original datasets are preserved. Manual reviews are stored in `data/manual_validation.json`, created on first save. Back up that file to preserve your decisions. For more complex source changes, validate source values outside the website and modify processed data only after a separate review.

## Data contents
- `data/` includes cleaned monthly / reference tables used by the recommendation engine, and full SMAP/NDVI observations.
- `data/raw_archive/` includes original daily climate/rainfall, crop economics and reference files, QA reports, crop screenshots, and additional source tables.
- `data/spatial/` includes SRTM/SoilGrids rasters, QGIS project, auxiliary GIS layers and climate rasters.
- `DATA_INVENTORY.csv` lists every included data file with exact file size and SHA-256 checksum.

## What is (and is not) calculated now
The initial ranking continues to use historical NASA POWER temperature, CHIRPS rainfall, modeled SoilGrids surface pH, and FAO ECOCROP tolerances. SMAP, NDVI, terrain, ERA5, crop economics and additional daily/GIS datasets are included for inspection or contextual display; **not all are active scoring criteria**. Manually approved temperature, soil pH and annual rainfall can replace their matching reference figures, and manually approved crop planting months can exclude incompatible planting months. No unsupported crop rotation or crop calendar rules have been invented.

All sources vary in spatial resolution. A 31-barangay point table is **not** a farm-specific field observation. Historical 2016–2025 data do not provide future forecasts or live alerts. Economic data through 2020 are historical and should not be represented as current market prices. The crop calendar folder contains an image, which has been retained as a source image rather than fabricated structured rules.
