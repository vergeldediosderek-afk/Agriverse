# AgriVerse — CHIRPS v3 Daily Rainfall (2016–2025): Processing and Quality Audit

## Findings
- **Status:** Passed completeness and internal-consistency checks. **Not** independently validated against local rain gauges.
- **Dataset:** `UCSB-CHC/CHIRPS/V3/DAILY_SAT` (IMERG-based daily disaggregation).
- **Date coverage:** 2016-01-01 through 2025-12-31 (3,653 days).
- **Barangay reference points:** 31; exactly 3,653 daily records for each.
- **Corrected daily records:** 113,243; no missing rainfall values, no duplicate barangay/date rows.
- **Underlying unique grid cells:** 21. Points in one cell share rainfall estimates. **Do not treat the 31 time series as independent spatial observations.**
- **Values:** 0.00–100.78 mm/day; 19,391 zero-rainfall entries. Zero is a valid reported estimate, unlike an empty cell.
- **Seven-day quality test:** all 217 July 1–7, 2025 readings matched the 2025 corrected annual CSV exactly.
- **Legacy invalid exports:** 2016–2025 `AgriVerse_CHIRPSv3_Valencia_31_Daily_YYYY.csv` contained blank rainfall. Those original exports were **excluded**.

## Files
1. `chirps_v3_daily_31_reference_points_2016_2025.csv`: cleaned combined 31-point daily observations.
2. `chirps_v3_monthly_31_reference_points.csv`: calendar monthly rainfall totals (sum of daily mm) plus summary counts and maximum.
3. `chirps_v3_annual_31_reference_points.csv`: calendar annual totals and summary counts.
4. `chirps_v3_month_of_year_reference_2016_2025.csv`: ten-year monthly reference means and ranges. **Not** a 30-year climate normal.
5. `barangay_to_chirps_grid_mapping.csv`: geographic coordinates, satellite grid indexes, shared-cell count.
6. `chirps_v3_daily_21_unique_pixels.csv`: daily values de-duplicated by reported satellite grid pixel and date. Useful to avoid counting duplicate pixel observations in spatial summary statistics.
7. `chirps_v3_monthly_21_unique_pixels.csv`: monthly values by unique source cell.
8. `quality_audit.json`: input provenance, checks, and counts.

## Scientific limitations and instructions
- The column `rainfall_mm_day` represents **daily estimated precipitation in millimeters**, not an observed weather-station value or farm rain gauge.
- A point located in a barangay samples a **single approximate 0.05-degree satellite grid cell**. It does not represent the whole barangay or an arbitrary farmer-drawn farm polygon.
- Daily CHIRPS v3 `SAT` estimates are derived by using **IMERG Late rainfall timing** to distribute CHIRPS v3 pentad totals. A CHIRPS daily label does not necessarily correspond to a single, uniform local-midnight-to-midnight gauge interval.
- Daily rainfall may be summed over a full calendar month/year to produce nominal monthly/yearly total estimates. For primary monthly validation, compare monthly sums with the separately released CHIRPS v3 monthly product or pentad totals where possible.
- CHIRPS v3 is gridded; **21** actual cells should not be reported as 31 independent ground measurements. Duplicate rows are retained in the 31-point file for UI mapping; use `chirps_v3_daily_21_unique_pixels.csv` for unweighted unique-source-cell summaries.
- These are 10-year historical records; they are **not real-time**. Recency, final/preliminary product status, and observation time should be stored separately when new data are retrieved.
- Extreme rainfall values (maximum 100.78 mm/day here) are not automatically invalid. Compare to local gauges, high-quality IMERG and source-product QA before identifying actual storm events or thresholds.
- Future production farm analysis should use farm-boundary/pixel intersections and coverage-weighted summaries, and state the resolution and uncertainty. Do not label sampled reference-point data as farm-specific.

## Dataset references
- Official Google Earth Engine: https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHC_CHIRPS_V3_DAILY_SAT
- Climate Hazards Center: https://www.chc.ucsb.edu/data/chirps3
- CHIRPS v3 DOI: https://doi.org/10.15780/G2JQ0P

Generated from the user's uploaded ZIP without changing or inventing original rainfall readings.
