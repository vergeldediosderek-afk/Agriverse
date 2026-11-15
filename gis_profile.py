"""Spatial evidence from the supplied Valencia GIS datasets."""
from functools import lru_cache
from statistics import mean
import csv
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
SPATIAL = ROOT / "data" / "spatial"
DEPS = ROOT / ".gis-deps"
if DEPS.is_dir():
    sys.path.insert(0, str(DEPS))

from recommendation_engine import YEARS, load, normalize, number, rainfall_history


@lru_cache(maxsize=1)
def vector_data():
    from pyogrio.raw import read
    from shapely import from_wkb
    from shapely.geometry import shape

    bounds = json.loads((SPATIAL / "valencia_barangays.geojson").read_text(encoding="utf-8"))
    metadata, _, geometry, fields = read(SPATIAL / "soilseries_Valencia.gpkg", columns=["SoilSeries", "SOILDESC"])
    features = []
    for blob, *values in zip(geometry, *fields):
        if blob:
            polygon = from_wkb(blob)
            features.append((polygon, dict(zip(metadata["fields"], values))))
    # This file declares an undefined CRS; its bounds are Valencia longitude/latitude.
    boxes = [polygon.bounds for polygon, _ in features]
    extent = [min(box[0] for box in boxes), min(box[1] for box in boxes),
              max(box[2] for box in boxes), max(box[3] for box in boxes)]
    if not (124.7 < extent[0] < extent[2] < 125.5 and 7.5 < extent[1] < extent[3] < 8.3):
        raise RuntimeError("Unexpected coordinate bounds in the soil-series layer")
    names = {row["psgc_2026"]: row["barangay"] for row in load()["reference"].values()}
    barangays = []
    for item in bounds["features"]:
        properties = item["properties"]
        name = names.get(properties["psgc"], properties["barangay"])
        properties["barangay"] = name
        barangays.append((name, shape(item["geometry"])))
    return bounds, barangays, features


def layers():
    bounds, _, soils = vector_data()
    from shapely.geometry import mapping
    return {"barangays": bounds, "soil_series": {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": mapping(polygon), "properties": properties}
        for polygon, properties in soils
    ]}}


def map_start(barangay, locality=""):
    reference = load()["reference"].get((normalize(barangay),))
    if not reference:
        raise ValueError("No map reference for this barangay")
    directory = SPATIAL / "valencia_purok_sitio.csv"
    if locality.strip() and directory.is_file():
        with directory.open(encoding="utf-8-sig", newline="") as stream:
            matches = [row for row in csv.DictReader(stream)
                       if normalize(row.get("barangay")) == normalize(barangay)
                       and normalize(row.get("locality")) == normalize(locality)]
        points = {(number(row.get("latitude"), -90, 90), number(row.get("longitude"), -180, 180))
                  for row in matches}
        if len(points) == 1:
            from shapely.geometry import Point
            latitude, longitude = next(iter(points))
            if latitude is not None and longitude is not None and any(
                normalize(name) == normalize(barangay) and polygon.covers(Point(longitude, latitude))
                for name, polygon in vector_data()[1]
            ):
                return {"latitude": latitude, "longitude": longitude, "basis": "Mapped purok/sitio",
                        "locality_verified": True, "message": "Mark your field on the map."}
    return {
        "latitude": float(reference["latitude"]), "longitude": float(reference["longitude"]),
        "basis": "Barangay reference point",
        "locality_verified": False,
        "message": "Purok/sitio could not be located in the available map data. Use the map to mark your field."
                   if locality.strip() else "Use the map to mark your field.",
    }


def profile(query):
    from shapely.geometry import Point, Polygon

    data = load()
    coords = query.get("points", [])
    if not isinstance(coords, list) or len(coords) > 300:
        raise ValueError("Use up to 300 plot corners")
    _, barangays, soils = vector_data()
    demo = query.get("demo") is True
    point = None
    area = None
    if len(coords) >= 3 and not demo:
        vertices = []
        for pair in coords:
            if not isinstance(pair, list) or len(pair) != 2:
                raise ValueError("Invalid plot corner")
            lat, lon = number(pair[0], -90, 90), number(pair[1], -180, 180)
            if lat is None or lon is None:
                raise ValueError("Invalid plot corner")
            vertices.append((lon, lat))
        area = Polygon(vertices)
        if not area.is_valid or area.area == 0:
            raise ValueError("Plot corners must form a valid, non-crossing boundary")
        point = area.representative_point()
        basis = "Sample inside drawn plot"
    if point is None:
        name = normalize(query.get("barangay") if isinstance(query.get("barangay"), str) else "")
        reference = data["reference"].get((name,))
        if reference is None:
            raise ValueError("Select a Valencia barangay or draw a plot inside Valencia")
        point = Point(float(reference["longitude"]), float(reference["latitude"]))
        basis = "Barangay reference point"

    overlaps = []
    if area is not None:
        overlaps = [(name, polygon.intersection(area)) for name, polygon in barangays if polygon.intersects(area)]
        overlaps = [(name, part) for name, part in overlaps if part.area > 0]
        if overlaps:
            name, largest = max(overlaps, key=lambda item: item[1].area)
            point = largest.representative_point()
    matches = [name] if overlaps else [name for name, polygon in barangays if polygon.covers(point)]
    if not matches:
        raise ValueError("This location is outside the Valencia GIS coverage")
    name = matches[0]
    soils_here = [properties for polygon, properties in soils
                  if (polygon.intersection(area).area > 0 if area is not None else polygon.covers(point))]
    series = sorted({row["SoilSeries"] for row in soils_here if row["SoilSeries"]})
    descriptions = sorted({row["SOILDESC"] for row in soils_here if row["SOILDESC"]})
    terrain_bands = {1: "elevation_m", 2: "slope_deg"}
    terrain, terrain_cells = plot_values("SRTM_Valencia_Terrain_30m_CLEAN.tif.tiff", point, terrain_bands, area)
    soil, soil_cells = plot_values("ORIGINAL_SoilGrids_Valencia_250m_55Bands.tif.tiff", point, {
        1: "ph", 7: "sand_pct", 13: "silt_pct", 19: "clay_pct",
        25: "organic_carbon_g_kg", 31: "unverified_total_nitrogen_g_kg", 37: "cec_cmolc_kg",
    }, area)
    month = query.get("month")
    key = (normalize(name), month) if type(month) is int and 1 <= month <= 12 else None
    smap = data["smap"].get(key, {})
    ndvi = data["ndvi"].get(key, {})
    climate = data["climate"].get(key, {})
    raster_climate = None
    if key:
        band = {12 * (year - 2016) + month: str(year) for year in YEARS}
        raster_climate = {
            label: climate_summary(sample(filename, point, band))
            for label, filename in (
                ("rainfall_mm", "Valencia_Rainfall_2016_2025.tif"),
                ("temperature_c", "Valencia_Temperature_2016_2025.tif"),
            )
        }
    spans = len(overlaps) > 1
    return {
        "barangay": name, "basis": basis, "spans_barangays": spans,
        "latitude": point.y, "longitude": point.x,
        "terrain": terrain, "soil": soil, "terrain_cells": terrain_cells, "soil_cells": soil_cells, "soil_series": series, "soil_description": descriptions,
        "month": month if key else None,
        "qgis_climate": raster_climate,
        "smap": number(smap.get("surface_soil_moisture_mean_m3_m3"), 0, 1),
        "ndvi": number(ndvi.get("ndvi_mean"), -1, 1),
        "temperature": number(climate.get("mean_temp_c"), -60, 65),
        "rainfall": monthly_rainfall(data, name, month) if key else None,
    }


def monthly_rainfall(data, name, month):
    records = rainfall_history(data["rainfall"], normalize(name))
    amounts = [records.get((year, month)) for year in YEARS]
    return mean(amounts) if None not in amounts else None


def climate_summary(samples):
    values = [value for value in samples.values() if value is not None]
    return {"mean": round(mean(values), 2) if values else None, "years": len(values)}


def plot_values(filename, point, bands, area):
    """Average valid raster cells whose centers fall within the field."""
    if area is not None:
        import numpy as np
        import rasterio
        from rasterio.mask import mask
        from rasterio.warp import transform_geom
        from shapely.geometry import mapping
        with rasterio.open(SPATIAL / filename) as source:
            geometry = transform_geom("EPSG:4326", source.crs, mapping(area))
            try:
                values, _ = mask(source, [geometry], indexes=list(bands), crop=True, filled=False)
            except ValueError:
                values = []
            estimates, counts = {}, {}
            for label, cells in zip(bands.values(), values):
                valid = cells.compressed()
                valid = valid[np.isfinite(valid)]
                estimates[label] = round(float(valid.mean()), 2) if valid.size else None
                counts[label] = int(valid.size)
            if any(counts.values()):
                return estimates, counts
    return sample(filename, point, bands), {}


def sample(filename, point, bands):
    from numpy.ma import getmaskarray
    import rasterio
    from rasterio.warp import transform
    with rasterio.open(SPATIAL / filename) as source:
        east, north = transform("EPSG:4326", source.crs, [point.x], [point.y])
        row, col = source.index(east[0], north[0])
        if not (0 <= row < source.height and 0 <= col < source.width):
            return dict.fromkeys(bands.values())
        values = next(source.sample([(east[0], north[0])], indexes=list(bands), masked=True))
        return {label: (round(float(value), 2) if not masked and math.isfinite(value) else None)
                for label, value, masked in zip(bands.values(), values.data, getmaskarray(values))}



@lru_cache(maxsize=1)
def road_layer():
    from pyogrio.raw import read
    from shapely import from_wkb
    from shapely.geometry import mapping
    from shapely.ops import unary_union

    city = unary_union([polygon for _, polygon in vector_data()[1]])
    meta, _, blobs, columns = read(SPATIAL / "Valencia_Roads.gpkg", columns=["name", "highway", "surface"])
    features = []
    for blob, *values in zip(blobs, *columns):
        if not blob:
            continue
        geometry = from_wkb(blob).intersection(city)
        if geometry.is_empty or geometry.length == 0:
            continue
        features.append({"type": "Feature", "geometry": mapping(geometry),
                         "properties": dict(zip(meta["fields"], values))})
    return {"type": "FeatureCollection", "features": features}


def seasonal_observations(barangay, year):
    from calendar import monthrange
    reference = load()["reference"].get((normalize(barangay),))
    if reference is None or year not in YEARS:
        raise ValueError("Choose a Valencia barangay and a year from 2016 to 2025")
    key = normalize(barangay)
    data = load()
    months = []
    for month in range(1, 13):
        rain = data["rainfall"].get((key, year, month), {})
        ndvi = data["ndvi"].get((key, month), {})
        months.append({
            "rain_mm": number(rain.get("precipitation_total_mm"), 0)
                       if number(rain.get("observations")) == monthrange(year, month)[1] else None,
            "typical_ndvi": number(ndvi.get("ndvi_mean"), -1, 1),
        })
    return {"months": months}
