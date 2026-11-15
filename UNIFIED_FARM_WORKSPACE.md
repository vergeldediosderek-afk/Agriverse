# AgriVerse — Unified Farmer Workspace

Instead of a separate crop-plan screen followed by a separate dashboard, crop decisions are now in the **Plans** tab beside the saved farm map.

1. Find and mark farm as before.
2. Choose Single Crop or Crop Rotation and complete history if needed.
3. The app opens the **Your farm. In focus.** workspace with the **Plans** tab selected.
4. Choose a single crop or a whole 3-season rotation sequence.
5. Select **Explore this crop/rotation** to view CropPedia; use the **Profit** tab to estimate farm finances.
6. Use the left-hand Farm/Seasons/Hazards/Access tabs without leaving the map.

## Scientific status
The plans are illustrative until full crop-specific soil, terrain, water and management data are validated. NASA POWER is historical gridded context, not an in-field sensor.

## Running
From the inner `AgriVerse` folder run `python server.py` and open http://localhost:8899.

## Modified files
- index.html — routes crop discovery into the unified dashboard; exposes plan selection to widget layer.
- assets/dashboard-focus.js — adds a Plans tab to the existing side widget.
- assets/farm-intelligence.js — changes the redundant back link to Edit farm.
- assets/unified-farmer-ux.js — renders single-crop and complete-rotation choices.
- assets/unified-farmer-ux.css — minimalist layout and readable text.
