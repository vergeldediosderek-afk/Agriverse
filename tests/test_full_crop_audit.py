import unittest
from unittest.mock import patch

import recommendation_engine as engine


class FullCropAuditTests(unittest.TestCase):
    @patch.object(engine, "list_records", return_value=[])
    def test_all_source_profiles_and_farm_shortlist(self, records):
        data = engine.load()
        result = engine.analyze("Sugod", 6, irrigation="rainfed")
        audit = result["crop_audit"]
        self.assertEqual(audit["source_records_checked"], 721)
        self.assertEqual(sum(audit["quality"].values()), 721)
        self.assertGreater(audit["quality"]["conflicting ranges"], 0)
        self.assertGreater(audit["research_candidates_checked"], 650)
        self.assertTrue(any(crop["name"] == "Tomato" for crop in result["recommendations"]))
        shortlist = [crop for crop in result["recommendations"] if crop["shortlist"]]
        self.assertTrue(shortlist)
        self.assertEqual([c["planning_score"] for c in shortlist], sorted((c["planning_score"] for c in shortlist), reverse=True))
        self.assertTrue(all(not c["long_term"] and not c["review_required"] for c in shortlist))
        self.assertEqual(len(shortlist), audit["farm_catalog_shortlisted"])
        corn = next(c for c in result["recommendations"] if c["id"] == "CR001")
        self.assertIn("global database", corn["source"])
        self.assertEqual(len(data["ecology"]), 721)
