"""Run with python -B -m unittest discover -s tests."""
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import unittest
from unittest.mock import patch

import recommendation_engine as engine


class ScreeningTests(unittest.TestCase):
    def test_cross_year_windows_and_missing_month(self):
        history = {(2023, 12): 25, (2024, 1): 50, (2024, 12): 300}
        self.assertEqual(engine.growing_rainfall(history, 12, 2), {
            "complete_windows": 1, "median_mm": 75, "min_mm": 75, "max_mm": 75,
        })
        self.assertIsNone(engine.complete_total(history, [(2024, 12), (2025, 1)]))

    def test_incomplete_chirps_month_is_skipped(self):
        rows = {
            ("sample", 2024, 2): {"observations": "28", "precipitation_total_mm": "10"},
            ("sample", 2023, 2): {"observations": "28", "precipitation_total_mm": "0"},
        }
        self.assertEqual(engine.rainfall_history(rows, "sample"), {(2023, 2): 0})

    def test_optimum_tolerance_and_missing_requirements(self):
        self.assertEqual(engine.score_interval(20, 20, 30, 10, 35), (100, "optimal"))
        self.assertEqual(engine.score_interval(15, 20, 30, 10, 35), (50, "outside optimum"))
        self.assertEqual(engine.score_interval(36, 20, 30, 10, 35), (0, "outside tolerance"))
        self.assertEqual(engine.score_interval(36, None, 30, 10, 35), (None, "unavailable"))

    @patch.object(engine, "list_records", return_value=[])
    def test_real_database_screening_and_rotation(self, reviews):
        with closing(engine.connect()) as db:
            self.assertEqual(db.execute("PRAGMA quick_check").fetchone()[0], "ok")
            with self.assertRaises(sqlite3.OperationalError):
                db.execute("DELETE FROM dataset_registry")
        result = engine.analyze("Bagontaas", 11, previous_crop="maize", field_ph=6.3, field_ph_source="kit")
        json.dumps(result, allow_nan=False)
        self.assertEqual(len(engine.status()["barangays"]), 31)
        self.assertEqual(result["dataset_backend"], "SQLite")
        self.assertEqual(result["environment"]["soil_ph_for_score"], 6.3)
        self.assertEqual(result["previous_crop_matched"], "Corn / maize")
        corn = next(crop for crop in result["recommendations"] if crop["id"] == "CR001")
        self.assertEqual(corn["rotation"], "same crop")
        self.assertLess(corn["growing_rainfall"]["complete_windows"], 10)
        self.assertEqual(result["evaluated_crop_count"] + result["not_matched_to_crop_requirements"], 98)

    @patch.object(engine, "list_records", return_value=[])
    def test_missing_annual_rain_is_not_scored_as_zero_or_partial(self, reviews):
        loaded = engine.load()
        rainfall = dict(loaded["rainfall"])
        rainfall.pop(("bagontaas", 2016, 1))
        with patch.object(engine, "load", return_value=dict(loaded, rainfall=rainfall)):
            result = engine.analyze("Bagontaas", 1)
        self.assertIsNone(result["environment"]["annual_climatology_chirps_mm"])
        self.assertTrue(all(crop["score"] is None for crop in result["recommendations"]))

    @patch.object(engine, "list_records")
    def test_local_calendar_overrides_global_and_rain_override_keeps_chirps_label(self, reviews):
        reviews.return_value = [
            dict(field="planting_months", barangay="", crop="Zea mays", value="11", status="approved"),
            dict(field="planting_months", barangay="Bagontaas", crop="Zea mays", value="1", status="approved"),
            dict(field="annual_rainfall_mm", barangay="Bagontaas", value="1234", status="approved", source="Test"),
        ]
        result = engine.analyze("Bagontaas", 11)
        corn = next(crop for crop in result["recommendations"] if crop["id"] == "CR001")
        self.assertEqual(corn["status"], "excluded")
        self.assertEqual(result["environment"]["annual_rainfall_for_score_mm"], 1234)
        self.assertNotEqual(result["environment"]["annual_climatology_chirps_mm"], 1234)

    def test_reject_invalid_location_and_fractional_month(self):
        with self.assertRaises(ValueError):
            engine.analyze("unknown barangay", 11, 7.9479588, 125.1017749)
        with self.assertRaises(ValueError):
            engine.analyze("Bagontaas", 11.5)
