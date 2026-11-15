"""Historical, barangay-level screening using the project's SQLite dataset registry."""
from calendar import monthrange
from datetime import date, timedelta
from contextlib import closing
from functools import lru_cache
import json
import math
from pathlib import Path
import statistics

from data_explorer import connect
from manual_validation import list_records
from setup_sqlite import quote_identifier

ROOT = Path(__file__).resolve().parent
YEARS = range(2016, 2026)
MONTHS = range(1, 13)
WEIGHTS = {"temperature": 0.45, "annual_rainfall": 0.35, "soil_ph": 0.20}
SOURCES = {
    "reference": "barangay_reference_points.csv",
    "climate": "power_monthly_climatology_2016_2025.csv",
    "climate_history": "power_monthly_2016_2025.csv",
    "rainfall": "chirps_v3_monthly_31_reference_points.csv",
    "soil": "SoilGrids_31_Barangays_Safe_Surface_Preview.csv",
    "terrain": "SRTM_31_Barangay_Reference_Point_Samples_FROM_RASTER.csv",
    "smap": "smap_monthly_quality_summary.csv",
    "ndvi": "ndvi_monthly_quality_summary.csv",
    "ecology": "Filtered_Valencia_Crops.csv",
}


def normalize(value):
    return " ".join((value or "").casefold().split())


def number(value, low=-math.inf, high=math.inf):
    try:
        value = float(value)
    except (ValueError, TypeError):
        return None
    return value if math.isfinite(value) and low <= value <= high else None


def registered_rows(db, filename):
    record = db.execute(
        "SELECT table_name FROM dataset_registry WHERE path = ? AND kind = 'csv'",
        (filename,),
    ).fetchone()
    if record is None or not record["table_name"]:
        raise RuntimeError(f"{filename} is missing from the SQLite dataset registry")
    table = quote_identifier(record["table_name"])
    return [dict(row) for row in db.execute(f"SELECT * FROM {table}")]


def index(rows, *fields):
    result = {}
    for row in rows:
        key = tuple(normalize(row[field]) if field == "barangay" else int(row[field]) for field in fields)
        if key in result:
            raise RuntimeError(f"Duplicate dataset key {key} for {fields}")
        result[key] = row
    return result


@lru_cache(maxsize=1)
def load():
    with closing(connect()) as db:
        db.execute("BEGIN")
        data = {key: registered_rows(db, filename) for key, filename in SOURCES.items()}
        full_ecology = registered_rows(db, "EcoCrop_DB.csv")
    catalog = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
    return {
        "reference": index(data["reference"], "barangay"),
        "climate": index(data["climate"], "barangay", "reference_month"),
        "climate_history": index(data["climate_history"], "barangay", "year", "month"),
        "rainfall": index(data["rainfall"], "barangay", "year", "month"),
        "soil": index(data["soil"], "barangay"),
        "terrain": index(data["terrain"], "barangay"),
        "smap": index(data["smap"], "barangay", "month"),
        "ndvi": index(data["ndvi"], "barangay", "month"),
        "ecology": {normalize(row["scientificname"]): row for row in data["ecology"]},
        "ecology_count": len(data["ecology"]),
        "full_ecology": {normalize(row["scientificname"]): row for row in full_ecology},
        "catalog": catalog,
    }


def resolve_barangay(reference, barangay, latitude, longitude):
    name = normalize(barangay)
    if name:
        if (name,) not in reference:
            raise ValueError("Select a supported Valencia City barangay")
        return name, "selected barangay"
    latitude = number(latitude, -90, 90)
    longitude = number(longitude, -180, 180)
    if latitude is None or longitude is None:
        raise ValueError("Select a Valencia City barangay or provide valid coordinates")
    candidates = []
    for (key,), row in reference.items():
        lat = number(row["latitude"], -90, 90)
        lon = number(row["longitude"], -180, 180)
        if lat is not None and lon is not None:
            distance = math.hypot(lat - latitude, math.cos(math.radians(latitude)) * (lon - longitude))
            candidates.append((distance, key))
    if not candidates or min(candidates)[0] > 0.22:
        raise ValueError("Coordinates are outside the available Valencia reference-point range")
    return min(candidates)[1], "nearest barangay reference point"


def rainfall_history(indexed, barangay):
    history = {}
    for year in YEARS:
        for month in MONTHS:
            row = indexed.get((barangay, year, month), {})
            if number(row.get("observations")) == monthrange(year, month)[1]:
                value = number(row.get("precipitation_total_mm"), 0)
                if value is not None:
                    history[year, month] = value
    return history


def complete_total(history, periods):
    values = [history.get(period) for period in periods]
    return sum(values) if all(value is not None for value in values) else None


def growing_rainfall(history, start, duration):
    """Summarize complete historical windows, including windows crossing New Year."""
    totals = []
    for year in YEARS:
        periods = [(year + offset // 12, offset % 12 + 1) for offset in range(start - 1, start - 1 + duration)]
        total = complete_total(history, periods)
        if total is not None:
            totals.append(total)
    return {
        "complete_windows": len(totals),
        "median_mm": round(statistics.median(totals), 1) if totals else None,
        "min_mm": round(min(totals), 1) if totals else None,
        "max_mm": round(max(totals), 1) if totals else None,
    }


def score_interval(value, optimum_low, optimum_high, tolerance_low, tolerance_high):
    """Score 100 within optimum and taper toward the published tolerance."""
    if value is None or optimum_low is None or optimum_high is None or optimum_low > optimum_high:
        return None, "unavailable"
    if optimum_low <= value <= optimum_high:
        return 100, "optimal"
    span = max(optimum_high - optimum_low, 1)
    if value < optimum_low:
        valid_bound = tolerance_low is not None and tolerance_low <= optimum_low
        distance = optimum_low - value
        margin = optimum_low - tolerance_low if valid_bound else span
    else:
        valid_bound = tolerance_high is not None and tolerance_high >= optimum_high
        distance = value - optimum_high
        margin = tolerance_high - optimum_high if valid_bound else span
    if valid_bound and distance > margin:
        return 0, "outside tolerance"
    return round(100 * max(0, 1 - distance / margin)), "outside optimum"


def criterion(value, profile, fields, low, high):
    limits = [number(profile.get(field), low, high) for field in fields]
    return score_interval(value, *limits)


def crop_history(catalog, previous_crop):
    previous = normalize(previous_crop)
    if not previous or previous == "unknown":
        return None
    matches = [
        crop for crop in catalog
        if previous in {normalize(part) for part in [crop["id"], crop["scientific"], crop["name"], *crop["name"].split("/")]}
    ]
    return matches[0] if len(matches) == 1 else None


@lru_cache(maxsize=1)
def crop_names():
    entries = {}
    for row in load()["full_ecology"].values():
        scientific = normalize(row["scientificname"])
        for name in [row["scientificname"], *(row.get("comname") or "").split(",")]:
            name = name.strip()
            if name and len(name) <= 80 and name.isprintable():
                entries.setdefault(normalize(name), set()).add(scientific)
    return entries


def crop_suggestions(query):
    key = normalize(query)
    if len(key) < 2:
        return []
    local = {
        normalize(name): name.strip()
        for crop in load()["catalog"] for name in crop["name"].split("/")
        if normalize(name).startswith(key)
    }
    names = crop_names()
    matches = [name for name in names if key in name and name not in local]
    matches.sort(key=lambda name: (not name.startswith(key), len(name), name))
    suggestions = list(local.values())
    for name in matches:
        options = names[name]
        if len(options) == 1:
            suggestions.append(name.capitalize())
        else:
            suggestions.extend(scientific.capitalize() for scientific in sorted(options))
        if len(suggestions) >= 20:
            break
    return list(dict.fromkeys(suggestions))[:20]


def previous_crop_profile(data, value):
    catalog_match = crop_history(data["catalog"], value)
    if catalog_match:
        return catalog_match
    candidates = crop_names().get(normalize(value), set())
    if len(candidates) == 1:
        scientific = next(iter(candidates))
        row = data["full_ecology"][scientific]
        return {"name": row["scientificname"], "scientific": scientific}
    return None


def family(crop, ecology):
    scientific = normalize(crop["scientific"])
    profile = ecology.get(ECOLOGY_SYNONYMS.get(scientific, scientific), {})
    return (profile.get("famname") or crop.get("family") or "").split(":")[-1].strip()


def valid_context(row, key, low, high):
    count = number(row.get("valid_samples"), 1)
    return (number(row.get(key), low, high), int(count)) if count else (None, 0)


ECOLOGY_FIELDS = (
    ("topmn", "topmx", "tmin", "tmax", -60, 65),
    ("ropmn", "ropmx", "rmin", "rmax", 0, math.inf),
    ("phopmn", "phopmx", "phmin", "phmax", 0, 14),
)
# EcoCrop's older tomato name explicitly lists Solanum lycopersicum as a synonym.
ECOLOGY_SYNONYMS = {"solanum lycopersicum": "lycopersicon esculentum"}


def profile_quality(profile):
    missing = False
    for lo, hi, minimum, maximum, low, high in ECOLOGY_FIELDS:
        a, b, c, d = (number(profile.get(key), low, high) for key in (lo, hi, minimum, maximum))
        if (a is not None and b is not None and a > b
                or c is not None and a is not None and c > a
                or d is not None and b is not None and b > d):
            return "conflicting ranges"
        missing |= a is None or b is None
    return "missing ranges" if missing else "usable ranges"


def historical_temperature_windows(records, barangay, start, duration):
    """Keep complete historical growing windows with their actual year-to-year variation."""
    windows = []
    for year in YEARS:
        values = []
        for offset in range(start - 1, start - 1 + duration):
            y, month = year + offset // 12, offset % 12 + 1
            row = records.get((barangay, y, month), {})
            days = monthrange(y, month)[1]
            if number(row.get("valid_temp_days")) != days:
                break
            value = number(row.get("mean_temp_c"), -60, 65)
            if value is None:
                break
            values.append(value)
        if len(values) == duration:
            windows.append(values)
    return windows


def conservative_score(baseline, historical_scores):
    """Give typical conditions 75% and the lower quartile of complete years 25%."""
    if baseline is None or len(historical_scores) < 5:
        return baseline
    lower_quartile = statistics.quantiles(historical_scores, n=4, method="inclusive")[0]
    return round(0.75 * baseline + 0.25 * lower_quartile)


def mapped_texture(texture, suffix=""):
    """Screen only clear clay-heavy and sandy surface estimates."""
    sand, silt, clay = (number(texture.get(key + suffix), 0, 100)
                        for key in ("sand_pct", "silt_pct", "clay_pct"))
    if None in (sand, silt, clay) or abs(sand + silt + clay - 100) > 2:
        return None
    if clay >= 40:
        return "heavy"
    if sand >= 85 and silt + 1.5 * clay < 15:
        return "light"
    if 7 <= clay < 27 and 28 <= silt < 50 and sand <= 52:
        return "medium"
    return None


def texture_fit(texture, profile):
    if texture is None:
        return "unknown"
    optimum = {tag.strip() for tag in (profile.get("text") or "").split(",")}
    tolerance = {tag.strip() for tag in (profile.get("textr") or "").split(",")}
    if texture in optimum or "wide" in optimum:
        return "preferred"
    if texture in tolerance or "wide" in tolerance:
        return "tolerated"
    return "review" if tolerance & {"heavy", "medium", "light", "organic"} else "unknown"


def drainage_fit(drainage, profile):
    if drainage not in ("well", "poorly"):
        return "unknown"
    preferred = (profile.get("dra") or "").split(",")
    tolerated = (profile.get("drar") or "").split(",")
    if any(value.strip().startswith(drainage + " (") for value in preferred):
        return "preferred"
    if any(value.strip().startswith(drainage + " (") for value in tolerated):
        return "tolerated"
    return "review" if any(tolerated) else "unknown"


def water_planning_adjustment(irrigation, window, dry_rain, dry_surface):
    """A relative scheduling caution, with no assumed crop water demand."""
    if irrigation not in ("rainfed", "limited") or not window or dry_rain is None:
        return 0
    exposed = sum(month in dry_rain for month in window)
    confirmed = sum(month in dry_rain and month in dry_surface for month in window)
    return round(6 * exposed / len(window) + 4 * confirmed / len(window))


def analyze(barangay, month, latitude=None, longitude=None, previous_crop="", irrigation="unknown",
            field_ph=None, field_ph_source=None, gis=None, year=None, available_days=None, start_day=1, include_research=True, drainage="unknown"):
    if type(month) is not int or month not in MONTHS:
        raise ValueError("Invalid planting month")
    if year is not None and (type(year) is not int or not 1900 <= year <= 2200):
        raise ValueError("Invalid planting year")
    if available_days is not None and (type(available_days) is not int or not 1 <= available_days <= 3650):
        raise ValueError("Available growing days must be between 1 and 3650")
    if drainage not in ("unknown", "well", "poorly"):
        raise ValueError("Choose a supported field drainage option")
    planting_date = date(year or 2025, month, start_day)
    data = load()
    location, location_basis = resolve_barangay(data["reference"], barangay, latitude, longitude)
    approvals = {
        (row["field"], normalize(row.get("barangay")), normalize(row.get("crop"))): row
        for row in list_records() if row["status"] == "approved"
    }
    ph_review = approvals.get(("soil_ph", location, ""))
    temp_review = approvals.get(("mean_temperature_c", location, ""))
    rain_review = approvals.get(("annual_rainfall_mm", location, ""))
    history = rainfall_history(data["rainfall"], location)
    annual_totals = [complete_total(history, [(year, m) for m in MONTHS]) for year in YEARS]
    annual = statistics.mean(annual_totals) if all(value is not None for value in annual_totals) else None
    monthly_rain = {}
    temperatures = {}
    for m in MONTHS:
        values = [history.get((year, m)) for year in YEARS]
        monthly_rain[m] = statistics.mean(values) if all(value is not None for value in values) else None
        row = data["climate"].get((location, m), {})
        temperatures[m] = (
            number(row.get("mean_temp_c"), -60, 65)
            if row.get("data_status") == "COMPLETE" and number(row.get("valid_years")) == len(YEARS)
            else None
        )
    historical_temperature = temperatures[month]
    if temp_review:
        temperatures[month] = float(temp_review["value"])
    rain_for_score = float(rain_review["value"]) if rain_review else annual
    typical_rain = statistics.median(monthly_rain.values()) if all(v is not None for v in monthly_rain.values()) else None
    if typical_rain is None:
        season = "Seasonal comparison unavailable"
    elif monthly_rain[month] == typical_rain:
        season = "At the local monthly rainfall median"
    else:
        season = "Wetter than local monthly median" if monthly_rain[month] > typical_rain else "Drier than local monthly median"

    dry_rain = ({m for m in MONTHS if monthly_rain[m] < typical_rain}
                if typical_rain is not None else None)
    moisture_months = {}
    for m in MONTHS:
        value, samples = valid_context(data["smap"].get((location, m), {}),
                                       "surface_soil_moisture_mean_m3_m3", 0, 1)
        if value is not None and samples >= 10:
            moisture_months[m] = value
    dry_surface = set()
    if len(moisture_months) >= 6:
        median_surface = statistics.median(moisture_months.values())
        dry_surface = {m for m, value in moisture_months.items() if value < median_surface}

    soil = data["soil"].get((location,), {})
    texture = mapped_texture(gis["soil"]) if gis else mapped_texture(soil, "_0_5cm")
    modelled_ph = number(soil.get("soil_ph_0_5cm"), 0, 14)
    if gis and gis["soil"].get("ph") is not None:
        modelled_ph = gis["soil"]["ph"]
    measured_ph = number(field_ph, 0, 14)
    if measured_ph is not None and field_ph_source in ("lab", "kit"):
        ph, ph_source = measured_ph, "Farmer-reported " + ("lab test" if field_ph_source == "lab" else "test kit")
    elif ph_review:
        ph, ph_source = float(ph_review["value"]), "Manually approved pH"
    else:
        ph, ph_source = modelled_ph, ("SoilGrids mapped plot surface pH"
                                      if gis and gis["soil"].get("ph") is not None else "SoilGrids modelled surface pH")
    terrain = data["terrain"].get((location,), {})
    elevation = number(terrain.get("elevation_m")) if terrain.get("quality_flag") == "VALID" else None
    slope = number(terrain.get("slope_deg"), 0, 90) if terrain.get("quality_flag") == "VALID" else None
    if gis:
        elevation = gis["terrain"].get("elevation_m")
        slope = gis["terrain"].get("slope_deg")
        location_basis = gis["basis"]
    moisture, smap_count = valid_context(data["smap"].get((location, month), {}), "surface_soil_moisture_mean_m3_m3", 0, 1)
    ndvi, ndvi_count = valid_context(data["ndvi"].get((location, month), {}), "ndvi_mean", -1, 1)

    previous = previous_crop_profile(data, previous_crop)
    previous_family = family(previous, data["full_ecology"]) if previous else ""
    recommendations, missing = [], []
    primary_species = {normalize(crop["scientific"]) for crop in data["catalog"]}
    matched_source_species = primary_species | {ECOLOGY_SYNONYMS.get(name, name) for name in primary_species}
    research_crops = [
        {"id": f"ECO-{row['ecoportcode']}", "name": row["scientificname"],
         "scientific": row["scientificname"], "research": True}
        for name, row in data["ecology"].items() if include_research and name not in matched_source_species
    ]
    audit = {"usable ranges": 0, "missing ranges": 0, "conflicting ranges": 0}
    for row in data["ecology"].values() if include_research else ():
        audit[profile_quality(row)] += 1
    research_results = []
    seasonal_windows = {}
    temperature_windows = {}
    for crop in [*data["catalog"], *research_crops]:
        scientific = normalize(crop["scientific"])
        source_species = ECOLOGY_SYNONYMS.get(scientific, scientific)
        profile = data["ecology"].get(source_species) or data["full_ecology"].get(source_species)
        source = "FAO EcoCrop · Valencia subset" if source_species in data["ecology"] else "FAO EcoCrop · global database"
        if source_species != scientific and profile:
            source += f" (listed as {profile['scientificname']})"
        if profile is None and not crop.get("verified"):
            missing.append(crop["name"])
            continue
        if profile is None:
            source = "Sourced catalog ecology"
            profile = {
                "topmn": crop.get("tempMin"), "topmx": crop.get("tempMax"),
                "ropmn": crop.get("annualRainMin"), "ropmx": crop.get("annualRainMax"),
                "phopmn": crop.get("phMin"), "phopmx": crop.get("phMax"),
            }
        days = number(profile.get("gmin"), 1) or number(crop.get("cycleMin"), 1)
        last_day = planting_date + timedelta(days=min(366, math.ceil(days or 1)) - 1)
        duration = min(12, (last_day.year - planting_date.year) * 12 + last_day.month - month + 1)
        if duration not in seasonal_windows:
            seasonal_windows[duration] = growing_rainfall(history, month, duration)
            temperature_windows[duration] = historical_temperature_windows(data.get("climate_history", {}), location, month, duration)
        window_excluded = bool(days and available_days and days > available_days)
        window = [(month - 1 + offset) % 12 + 1 for offset in range(duration)]
        temperature_checks = [
            criterion(temperatures[m], profile, ("topmn", "topmx", "tmin", "tmax"), -60, 65)
            for m in window
        ]
        temperature_scores = [score for score, _ in temperature_checks]
        temp_score = (
            round(0.75 * statistics.mean(temperature_scores) + 0.25 * min(temperature_scores))
            if None not in temperature_scores else None
        )
        rain_score, rain_band = criterion(rain_for_score, profile, ("ropmn", "ropmx", "rmin", "rmax"), 0, math.inf)
        if not temp_review and temp_score is not None:
            temperature_fields = ("topmn", "topmx", "tmin", "tmax")
            temp_score = conservative_score(temp_score, [
                0.75 * statistics.mean(scores) + 0.25 * min(scores)
                for scores in (
                    [criterion(value, profile, temperature_fields, -60, 65)[0] for value in values]
                    for values in temperature_windows[duration]
                )
            ])
        if not rain_review and rain_score is not None:
            rain_score = conservative_score(rain_score, [
                criterion(total, profile, ("ropmn", "ropmx", "rmin", "rmax"), 0, math.inf)[0]
                for total in annual_totals if total is not None
            ])
        ph_score, ph_band = criterion(ph, profile, ("phopmn", "phopmx", "phmin", "phmax"), 0, 14)
        checks = {"temperature": temp_score, "annual_rainfall": rain_score, "soil_ph": ph_score}
        quality = profile_quality(profile)
        coverage = sum(weight for key, weight in WEIGHTS.items() if checks[key] is not None)
        score = round(sum(WEIGHTS[key] * checks[key] for key in WEIGHTS)) if quality == "usable ranges" and all(v is not None for v in checks.values()) else None
        local_calendar = approvals.get(("planting_months", location, scientific))
        calendar = local_calendar or approvals.get(("planting_months", "", scientific))
        calendar_excluded = bool(calendar and month not in {int(m) for m in calendar["value"].split(",")})
        soil_fit = texture_fit(texture, profile)
        drainage_check = drainage_fit(drainage, profile)
        water_adjustment = water_planning_adjustment(irrigation, window, dry_rain, dry_surface)
        planning_score = max(0, score - water_adjustment) if score is not None else None
        crop_family = family(crop, data["full_ecology"])
        rotation = "unassessed"
        if previous:
            if source_species == ECOLOGY_SYNONYMS.get(normalize(previous["scientific"]), normalize(previous["scientific"])):
                rotation = "same crop"
            elif crop_family and previous_family:
                rotation = "same family" if normalize(crop_family) == normalize(previous_family) else "different family"
        reasons = []
        if calendar_excluded:
            reasons.append("Planting month falls outside the approved crop calendar")
        if window_excluded:
            reasons.append(f"Needs at least {days:g} days; you have {available_days} days")
        temp_bands = {band for _, band in temperature_checks}
        if "outside tolerance" in temp_bands:
            reasons.append("Growing-window monthly mean crosses published temperature tolerance")
        elif "outside optimum" in temp_bands:
            reasons.append("Growing-window temperature is outside the optimum in at least one month")
        if rain_band in ("outside tolerance", "outside optimum"):
            reasons.append(f"Annual rainfall is {rain_band} for this crop")
        if drainage_check == "review":
            reasons.append("Reported field drainage is outside the crop's listed range")
        if soil_fit == "review":
            reasons.append("Check soil texture on site. The mapped texture is outside the listed range.")
        if ph_band in ("outside tolerance", "outside optimum"):
            reasons.append(f"Soil pH is {ph_band} for this crop")
        altitude_limit = number(profile.get("altmx"), 1)
        if elevation is not None and altitude_limit is not None and elevation > altitude_limit:
            reasons.append(f"Reference elevation exceeds the published maximum of {altitude_limit:g} m")
        if rotation == "same crop":
            reasons.append("Repeats the previous crop")
        if rotation == "same family":
            reasons.append("Shares the previous crop’s botanical family")
        drier_months = sum(monthly_rain[m] < typical_rain for m in window) if typical_rain is not None else None
        if irrigation in ("rainfed", "limited") and drier_months:
            reasons.append("Growing window includes months with below-median local rainfall")
        if not days:
            reasons.append("Crop duration missing. Window covers the planting month only")
        if quality == "conflicting ranges":
            reasons.append("Published ranges conflict and need manual review")
        if score is None and any(v is None for v in checks.values()):
            labels = {"temperature": "temperature", "annual_rainfall": "annual rainfall", "soil_ph": "soil pH"}
            incomplete = ", ".join(labels[key] for key, value in checks.items() if value is None)
            reasons.append(f"Insufficient data or published requirements for {incomplete}")
        long_term = crop.get("growth") in {"Perennial/long cycle", "Cover/forage"}
        if long_term:
            reasons.append("Listed separately from crops for one planting season")
        review = (
            quality != "usable ranges" or score is None or not days
            or "outside tolerance" in temp_bands or rain_band == "outside tolerance"
            or ph_band == "outside tolerance" or soil_fit == "review" or drainage_check == "review"
            or elevation is not None and altitude_limit is not None and elevation > altitude_limit
        )
        destination = research_results if crop.get("research") else recommendations
        destination.append({
            "id": crop["id"], "name": crop["name"], "scientific": crop["scientific"],
            "family": crop_family, "score": score,
            "status": "excluded" if calendar_excluded or window_excluded else "conditional" if reasons else "screened",
            "shortlist": not (calendar_excluded or window_excluded or review or long_term),
            "long_term": long_term,
            "review_required": review,
            "source": source,
            "source_url": (f"https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id={profile['ecoportcode']}"
                           if str(profile.get("ecoportcode", "")).isdigit() else crop.get("source")),
            "optimal_ranges": {
                label: number(profile.get(field))
                for label, field in (
                    ("tempMin", "topmn"), ("tempMax", "topmx"),
                    ("annualRainMin", "ropmn"), ("annualRainMax", "ropmx"),
                    ("phMin", "phopmn"), ("phMax", "phopmx"),
                )
            },
            "checks": dict(checks, modelled_surface_ph=ph_score if ph_source.startswith("SoilGrids") else None),
            "coverage_pct": round(100 * coverage),
            "growing_months_assessed": duration, "growing_months": window,
            "growing_rainfall": seasonal_windows[duration],
            "minimum_growing_days": days, "evidence_label": (
                "Three scoring checks available" if score is not None else "Scoring evidence incomplete"
            ),
            "manual_calendar": "approved" if calendar else "missing",
            "rotation": rotation, "reasons": reasons,
            "texture_fit": soil_fit, "drier_months": drier_months,
            "drainage_fit": drainage_check, "water_adjustment": water_adjustment,
            "planning_score": planning_score,
        })
    rotation_order = {"different family": 0, "unassessed": 1, "same family": 2, "same crop": 3}
    texture_order = {"preferred": 0, "tolerated": 1, "unknown": 2, "review": 3}
    def rank(crop):
        return (
            not crop["shortlist"], crop["status"] == "excluded", crop["planning_score"] is None, -(crop["planning_score"] or 0),
            crop["manual_calendar"] != "approved", rotation_order[crop["rotation"]],
            texture_order[crop["texture_fit"]],
            (crop["drier_months"] or 0) / crop["growing_months_assessed"] if irrigation in ("rainfed", "limited") else 0,
            crop["minimum_growing_days"] or math.inf, crop["name"],
        )
    recommendations.sort(key=rank)
    research_results.sort(key=rank)
    def rounded(value):
        return round(value, 1) if value is not None else None
    return {
        "location": {
            "barangay": data["reference"][location,]["barangay"], "selection_basis": location_basis,
            "latitude": gis["latitude"] if gis and "latitude" in gis else float(data["reference"][location,]["latitude"]),
            "longitude": gis["longitude"] if gis and "longitude" in gis else float(data["reference"][location,]["longitude"]),
            "spatial_notice": "Historical climate for the barangay covering the largest part of the field"
                              if gis else "Historical estimates for a barangay reference point",
            "spans_barangays": bool(gis and gis.get("spans_barangays")),
        },
        "month": month, "year": year, "available_growing_days": available_days, "season": season, "score_weights": WEIGHTS, "dataset_backend": "SQLite",
        "environment": {
            "mean_temperature_c": temperatures[month], "historical_temperature_c": historical_temperature,
            "monthly_rain_chirps_mm": rounded(monthly_rain[month]), "annual_climatology_chirps_mm": rounded(annual),
            "annual_rainfall_for_score_mm": rounded(rain_for_score), "modelled_soil_ph": modelled_ph,
            "soil_ph_for_score": ph, "soil_ph_source": ph_source,
            "mapped_texture_group": texture, "reported_drainage": drainage,
            "irrigation": irrigation,
            "surface_soil_moisture_m3_m3": moisture, "smap_quality_samples": smap_count,
            "ndvi": ndvi, "ndvi_quality_samples": ndvi_count, "elevation_m": elevation, "slope_deg": slope,
        },
        "manual_validation": {
            "soil_ph_override": bool(ph_review) and ph_source == "Manually approved pH",
            "temperature_override_selected_month": bool(temp_review), "annual_rainfall_override": bool(rain_review),
            "sources": {key: review["source"] for key, review in {
                "soil_ph": ph_review if ph_source == "Manually approved pH" else None,
                "mean_temperature_c": temp_review, "annual_rainfall_mm": rain_review,
            }.items() if review},
        },
        "previous_crop_matched": previous["name"] if previous else None,
        "evaluated_crop_count": len(recommendations), "not_matched_to_crop_requirements": len(missing),
        "missing_crop_names": missing, "recommendations": recommendations,
        "crop_audit": {
            "source_records_checked": data["ecology_count"], "quality": audit,
            "farm_catalog_checked": len(data["catalog"]),
            "farm_catalog_shortlisted": sum(crop["shortlist"] for crop in recommendations),
            "research_candidates_checked": len(research_results),
            "research_candidates_passing": sum(crop["shortlist"] for crop in research_results),
            "research_examples": [crop for crop in research_results if crop["shortlist"]][:5],
        },
        "limitations": [
            "Historical reference-point estimates cover 2016–2025. Farm conditions and future weather can differ.",
            "Growing-window rainfall uses complete CHIRPS months from each historical window. The window uses the published minimum cycle, checked against the calendar months it touches, up to one year.",
            "Mapped surface texture is a separate shortlist check when confidently classifiable. Unknown texture stays unscored.",
            "Only pH contributes to the soil score. Mapped carbon, CEC and unverified nitrogen do not determine fertilizer needs.",
            "Annual rainfall scores use annual EcoCrop ranges. A crop water budget requires effective rainfall, crop evapotranspiration and irrigation data.",
            "Scores give typical climate 75% and the lower quartile of historical climate fit 25% when at least five complete windows are available. Outside-tolerance checks and missing growing duration require review before shortlisting. Rotation uses botanical family to break score ties.",
            "Monthly temperature means, modelled soil pH, and reference elevation can prompt review. Exclusions require an approved planting calendar or a growing window shorter than the published minimum duration.",
            "Rainfed or limited-water plans receive a small planning adjustment for drier months, supported by SMAP when enough samples are available. This does not estimate irrigation demand.",
            "MODIS NDVI and slope provide context. Field-level thresholds and local calendars require independent validation.",
        ],
    }


def status():
    data = load()
    return {
        "ready": True, "dataset_backend": "SQLite",
        "barangays": sorted(row["barangay"] for row in data["reference"].values()),
        "crop_catalog_count": len(data["catalog"]), "filtered_ecocrop_records": data["ecology_count"],
        "data_sources": list(SOURCES.values()), "scope": "Valencia City, Bukidnon reference-point screening",
    }
