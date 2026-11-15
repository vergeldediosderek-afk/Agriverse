"""Read-only Drive source inventory and historical evidence for the Analysis page."""
from calendar import monthrange
from contextlib import closing
from functools import lru_cache
import json
from pathlib import Path
from statistics import mean

from data_explorer import connect
from recommendation_engine import number
from setup_sqlite import quote_identifier

ROOT = Path(__file__).resolve().parent
ERA5 = "ERA5_Land_Monthly_31_Barangay_Points_2016_2025.csv"
KEYS = {
    "mean_temp_c": (-60, 65),
    "mean_daily_min_temp_c": (-60, 65),
    "mean_daily_max_temp_c": (-60, 65),
    "mean_rh_from_daily_means_approx_pct": (0, 100),
    "mean_daily_solar_mj_m2": (0, 60),
    "mean_vector_wind_speed_ms": (0, 100),
}
CALENDAR = {
    "bitter gourd": (range(1, 13), "60–75 days after planting"),
    "cabbage": ((10, 11, 12), "55–60 days after planting"),
    "carrot": (range(1, 13), "75–103 days after planting"),
    "chinese cabbage": ((10, 11, 12), "55–65 days after transplanting"),
    "eggplant": (range(1, 13), "90–120 days after planting"),
    "okra": (range(1, 13), "60–75 days after planting"),
    "yardlong bean": (range(1, 13), "50–65 days after planting"),
    "potato": ((9, 10, 11, 12, 1), "110–120 days after transplanting"),
    "common bean": (range(1, 13), "43–52 days after planting"),
    "squash": ((11, 12, 1), "3–5 months"),
    "tomato": ((1, 2, 3, 4, 5, 9, 10), "55–65 days after transplanting"),
}
CALENDAR_URL = "https://drive.google.com/file/d/1DGkhW4H6N1z1FkV95Mi8Hkn3sWUOljVT/view"


def source_inventory():
    manifest = json.loads((ROOT / "drive_inventory.json").read_text(encoding="utf-8"))
    with closing(connect()) as database:
        tables = {row["path"]: row["table_name"] for row in database.execute(
            "SELECT path, table_name FROM dataset_registry"
        )}
    for file in manifest["files"]:
        name = file["name"]
        archived = "/".join(part for part in ("drive_sources", file["folder"], name) if part)
        candidates = (archived, name, f"raw_archive/{name}", f"spatial/{name}", f"spatial/{name}.tiff")
        for candidate in candidates:
            path = ROOT / "data" / candidate
            if path.is_file() and path.stat().st_size == file["bytes"]:
                file.update(local_path=candidate, table=tables.get(candidate))
                break
        file.pop("local_match", None)
    return manifest


@lru_cache(maxsize=372)
def monthly_context(barangay, month):
    with closing(connect()) as database:
        item = database.execute("SELECT table_name FROM dataset_registry WHERE path=?", (ERA5,)).fetchone()
        if item is None:
            return None
        table = quote_identifier(item["table_name"])
        rows = database.execute(
            f"SELECT * FROM {table} WHERE barangay = ? COLLATE NOCASE AND CAST(month AS INTEGER) = ?",
            (barangay, month),
        )
        records = {}
        for row in rows:
            year = int(row["year"])
            if year in range(2016, 2026) and int(row["number_of_days"]) == monthrange(year, month)[1]:
                if year in records:
                    raise RuntimeError("Duplicate ERA5-Land month for this barangay")
                records[year] = row
    result = {"source": ERA5, "complete_years": len(records)}
    for key, limits in KEYS.items():
        values = [number(row[key], *limits) for row in records.values()]
        result[key] = round(mean(values), 2) if values and None not in values else None
    return result


def attach_context(result):
    month = result["month"]
    result["era5_land"] = monthly_context(result["location"]["barangay"], month)
    result["vegetable_calendar"] = {
        "url": CALENDAR_URL,
        "entries": {
            name: {"months": list(months), "covers_selected_month": month in months, "maturity": maturity}
            for name, (months, maturity) in CALENDAR.items()
        },
    }
    result["psa_benchmarks"] = psa_benchmarks()
    return result


def psa_benchmarks():
    with closing(connect()) as database:
        source = database.execute("SELECT table_name FROM dataset_registry WHERE path=?",
                                  ("AgriVerse_PSA_2020_Crop_Economics.csv",)).fetchone()
        if not source:
            return []
        table = quote_identifier(source["table_name"])
        keys = ("commodity, reference_year, geographic_scope, yield_kg_ha, farmgate_price_php_kg, "
                "gross_returns_php_ha, total_costs_php_ha, net_returns_php_ha")
        return [dict(row) for row in database.execute(f"SELECT {keys} FROM {table} ORDER BY commodity")]
