# AgriVerse — NASA POWER Solar Radiation and Humidity: Validation Notes

Source: NASA POWER daily point API; original file `POWER_Point_Daily_20160101_20251231_007d95N_125d10E_LST.csv`. Original untouched.
Location requested: Bagontaas sample coordinate (7.9479588°N, 125.1017749°E), Valencia City, Bukidnon. Coordinates in original header rounded to 7.948, 125.1018.
Study dates: 2016-01-01 through 2025-12-31, LST (local solar time).
Total rows: 3653; missing solar: 0; missing humidity: 0. -999 interpreted as no data, never zero.
Mean daily solar radiation: 18.1156 MJ/m²/day. Mean daily relative humidity: 88.4273%. These are reference-grid estimates, not on-farm ground measurements.

Variables:
- ALLSKY_SFC_SW_DWN — daily all-sky downward shortwave solar energy at surface, MJ/m²/day; source CERES SYN1deg.
- RH2M — relative humidity at 2 meters, %; source MERRA-2.
- YEAR and DOY — used to construct ISO calendar dates. Leap years treated correctly.

Files:
- `power_solar_humidity_daily_2016_2025.csv`: entire daily series with ISO dates and coordinate/source metadata.
- `power_monthly_2016_2025.csv`: monthly solar mean and total; monthly humidity mean, minimum, maximum, and sample counts. A total should be used only when all days for that month are valid; check `solar_valid_days` against `days`.
- `power_month_of_year_reference_2016_2025.csv`: month-of-year climatology from 2016–2025 (a 10-year *reference*, not a standard 30-year climate normal).
- `power_yearly_2016_2025.csv`: annual metrics.

Scientific limitations:
- Solar radiation derives from CERES SYN1deg and relative humidity from MERRA-2 with different native resolutions; do not treat data as measured precisely at the specified farm coordinate.
- 2016–2025 is only a 10-year period. These historical estimates cannot be called real-time observations or operational weather forecasts.
- These readings alone cannot determine crop suitability or irrigation volume without additional crop, soil, land management, wind, temperature, precipitation and evapotranspiration data.
- The existing 31 barangay reference points do not provide reliable within-barangay farm-scale estimates; retrieve the environmental values at farmer coordinates dynamically and disclose dataset spatial limits.
