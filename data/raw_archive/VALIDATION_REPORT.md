# AgriVerse ERA5-Land 2016–2025 | Validation report

## Verdict
PASS for **completeness, internally consistent values, key uniqueness, and source-band/units plausibility**. This is *not* an independent validation of physical accuracy against local weather stations or original ECMWF raster values.

## Counts
- Selected **10 original yearly CSVs**, one per year, 2016–2025. The uploaded `(1)` versions are redundant copies; years 2016–2024 differ only in tiny rounding of estimated RH (no substantive differences). Year 2025 is byte-identical to the previously uploaded original.
- **113,243 total rows = 3,653 calendar days × 31 barangays**, with leap days (2016, 2020, 2024).
- **3,653 dates**, each with 31 records; **31 unique barangay names**, each with 3,653 records.
- **0 missing met values** in the selected yearly files; 0 nonnumeric values; 0 duplicate `barangay + date_utc` keys; 0 dates missing.
- **10 distinct underlying ERA5-Land grid pixels** represented by 31 reference points. For each grid pixel and date, measurements agree across all mapped reference points (0 inconsistencies).
- 0 temperature order problems (minimum <= mean <= maximum), 0 RH outside 0–100%, 0 negative solar or wind values.
- Uploaded `(1)` copies vs originals: maximum absolute value difference **4.3e-14**, restricted to the `rh_from_daily_means_approx_pct` field; row ordering may differ.

## Scientific scope and important limitations
1. **ERA5-Land reanalysis (~11.1 km pixel)** combines numerical modeling and data assimilation; it is not live measurement at a barangay or farm and not a barangay polygon average. 31 points map to 10 cells, so do not regard all 31 time series as statistically independent.
2. `temperature_2m`, `temperature_2m_min`, `temperature_2m_max` were converted from Kelvin to degrees Celsius correctly by subtracting 273.15.
3. `surface_solar_radiation_downwards_sum` is J/m²/day; dividing by 1,000,000 gives MJ/m²/day. The daily accumulation band can have rare artifacts. None of the included solar values is negative, but verification against a separate source is advisable.
4. `rh_from_daily_means_approx_pct`: approximation using relative humidity vapor-pressure formula applied to daily mean air temperature/dewpoint. **Not** the arithmetic average of hourly RH. Daily average humidity may differ.
5. `wind_from_mean_uv_ms`: speed **computed from average wind-vector components**, not the average of hourly wind speeds. The magnitude of a mean vector can be lower than the mean scalar wind speed. Avoid presenting as observed daily wind speed.
6. Dates are **UTC** calendar dates, not necessarily matching a day defined as 00:00–23:59 Philippine Time (UTC+8).
7. `mean_daily_min_temp_c`/`mean_daily_max_temp_c` in monthly/annual summaries are means of daily minima/maxima; `period_lowest_min_temp_c`/`period_highest_max_temp_c` are the actual extremes over the period.
8. Source point coordinates and names are inherited from input Earth Engine export; an authoritative PSGC boundary and location audit was not performed in this step. A drawn farm boundary must be dynamically evaluated against source grids rather than reusing barangay reference points as farm-specific conditions.
9. Annual and monthly aggregations are across **UTC dates**, using the non-missing daily records for each calendar month/year. `total_solar_mj_m2` is summed daily solar energy per area; temperature, humidity, and wind indicators are averaged. Solar totals are not rainfall.
10. Values are suitable as a **research baseline**, subject to spatial validation and ground-station cross-checks. Do not assert that they are 99% accurate or precise on-farm readings.

## Source and conversions
- Earth Engine dataset: `ECMWF/ERA5_LAND/DAILY_AGGR` — <https://developers.google.com/earth-engine/datasets/catalog/ECMWF_ERA5_LAND_DAILY_AGGR>
- Dataset documentation notes resolution of 11,132 m and that model-grid data differ from ground-station point data.
- Earlier independently quality-checked 2025 dataset is identical in the selected original file. 2016–2024 were validated from uploaded yearly exports.

## Files
- `ERA5_Land_Daily_31_Barangay_Points_2016_2025.csv` — original daily records selected, source field names preserved.
- `ERA5_Land_Monthly_31_Barangay_Points_2016_2025.csv` — 3,720 (31 × 120) monthly summary rows.
- `ERA5_Land_Annual_31_Barangay_Points_2016_2025.csv` — 310 (31 × 10) annual summary rows.
- `ERA5_Barangay_Point_and_Grid_Mapping.csv` — point coordinates and shared ERA5 grid identifiers.
- `DUPLICATE_UPLOAD_COMPARISON.csv` — copy-vs-original numerical difference audit.
- `VALIDATION_REPORT.md` — this file.

## What to do next
Keep this historical ERA5-Land data alongside the already verified **CHIRPS v3 2016–2025 rainfall** data, preserving separate dataset provenance and resolution. Next stage is recent rainfall monitoring, official warnings and forecast layers, then coordinate-based farm polygon integration.
