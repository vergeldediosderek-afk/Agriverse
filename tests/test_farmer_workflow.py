from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

import gis_profile
import recommendation_engine as engine


class FarmerWorkflowTests(TestCase):
    @patch.object(engine, "list_records", return_value=[])
    def test_growing_window_filters_and_scores(self, records):
        baseline = engine.analyze("Bagontaas", 4, year=2027)
        limited = engine.analyze("Bagontaas", 4, year=2027, available_days=50)
        self.assertEqual(limited["year"], 2027)
        self.assertTrue(any(c["status"] == "excluded" for c in limited["recommendations"]))
        old = {c["id"]: c for c in baseline["recommendations"]}
        for crop in limited["recommendations"]:
            days = crop["minimum_growing_days"]
            self.assertEqual(crop["status"] == "excluded", days is not None and days > 50)
            self.assertEqual(crop["score"], old[crop["id"]]["score"])
            if crop["score"] is not None:
                self.assertEqual(crop["score"], round(sum(
                    weight * crop["checks"][key] for key, weight in engine.WEIGHTS.items()
                )))
        with self.assertRaises(ValueError):
            engine.analyze("Bagontaas", 4, available_days=2.5)

    def test_locality_matching_rejects_wrong_barangay_and_duplicates(self):
        reference = gis_profile.map_start("Bagontaas")
        self.assertFalse(reference["locality_verified"])
        with TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "valencia_purok_sitio.csv"
            gis_profile.vector_data()
            with patch.object(gis_profile, "SPATIAL", root):
                path.write_text("barangay,locality,latitude,longitude\nBagontaas,Test Sitio,7.9479588,125.1017749\n"
                                "Barobo,Test Sitio,7.9479588,125.1017749\n", encoding="utf-8")
                self.assertTrue(gis_profile.map_start("Bagontaas", " test  sitio ")["locality_verified"])
                self.assertFalse(gis_profile.map_start("Barobo", "Test Sitio")["locality_verified"])
                with path.open("a", encoding="utf-8") as stream:
                    stream.write("Bagontaas,Test Sitio,7.948,125.1018\n")
                self.assertFalse(gis_profile.map_start("Bagontaas", "Test Sitio")["locality_verified"])
