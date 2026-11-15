import unittest
from recommendation_engine import mapped_texture, texture_fit, crop_suggestions, water_planning_adjustment, drainage_fit


class FarmScreeningTests(unittest.TestCase):
    def test_mapped_texture_and_published_ranges(self):
        heavy = mapped_texture({"sand_pct": 15, "silt_pct": 35, "clay_pct": 50})
        self.assertEqual(heavy, "heavy")
        self.assertEqual(texture_fit(heavy, {"text": "heavy, medium"}), "preferred")
        self.assertEqual(texture_fit(heavy, {"text": "medium", "textr": "heavy, medium"}), "tolerated")
        self.assertEqual(texture_fit(heavy, {"text": "medium", "textr": "light, medium"}), "review")
        self.assertEqual(texture_fit(None, {"textr": "medium"}), "unknown")

    def test_common_local_names_first(self):
        self.assertEqual(crop_suggestions("cass")[0], "Cassava")

    def test_water_adjustment_uses_irrigation_and_agreeing_evidence(self):
        self.assertEqual(water_planning_adjustment("irrigated", [1, 2], {1, 2}, {1}), 0)
        self.assertEqual(water_planning_adjustment("rainfed", [1, 2], {1, 2}, {1}), 8)
        self.assertEqual(water_planning_adjustment("rainfed", [1, 2], None, {1}), 0)

    def test_drainage_only_uses_reported_condition(self):
        profile = {"dra": "well (dry spells)", "drar": "well (dry spells)"}
        self.assertEqual(drainage_fit("unknown", profile), "unknown")
        self.assertEqual(drainage_fit("poorly", profile), "review")
        self.assertEqual(drainage_fit("well", profile), "preferred")
