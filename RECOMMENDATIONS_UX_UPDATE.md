# AgriVerse — Simpler Crop Recommendations

## Changes
- Removed the large NASA POWER statistics/chart panel from the crop selection page. NASA historical observations remain in `state.nasa` and the Farm Intelligence data model.
- **Single Crop:** the recommendation page displays individual crop candidates.
- **Crop Rotation:** the page displays **three complete multi-season rotation sequences**, not separate crop candidates.
- Selecting a rotation highlights the complete sequence. The **View selected rotation** button then opens the existing Farm Intelligence screen.
- Previous crop history remains available to the sequence generator.
- Reduced crowded explanatory and warning components in the recommendation selection screen. This does not remove official warnings or data from the main dashboard.

## Important limitation
The displayed rotation sequences are illustrative planning alternatives, not scientifically validated recommendations for the individual farm. Soil, slope, water availability, planting windows, pests and crop-specific requirements still require validated data.

## Manual update
Replace `index.html` and copy `assets/recommendations-simple.css` into your existing `AgriVerse/assets/` folder. Make a backup first.

## Start
From the extracted inner `AgriVerse` folder: `python server.py`, then open `http://localhost:8899`. Use Ctrl+Shift+R if old content appears.
