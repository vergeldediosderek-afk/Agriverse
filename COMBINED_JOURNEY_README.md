# AgriVerse — Combined Find & Shape Your Farm UX

This update simplifies the first part of Farmer mode while preserving the farm mapping and subsequent crop planning screens.

## Flow

1. **Choose your island** — centered Philippines map; tap a group.
2. **Choose your place** — Province, City / Municipality, Barangay, and farmer-entered Purok / Sitio; the selected island is illustrated on the right.
3. **Outline your farm** — the location panel slides away; the real Leaflet field-map and existing boundary controls replace it in the same visible page.
4. **Review your land** — after explicitly confirming the actual/demonstration boundary, a summary of known information and a crop-discovery call to action appear above the saved map.
5. **View crop recommendations** — continue through the preserved strategy and existing recommendation flow.

**Data integrity:** A Purok/Sitio name typed by the farmer is *not* a verified geographic point. The aerial map starts from a known city center or verified coordinate if available; the farmer must zoom and draw their actual plot. Soil nutrients, elevation, slope and reliable irrigation measurements remain 'Not tested/Not connected' until real layers or field measurements are integrated. Offline test polygons are demonstrative and explicitly identified as such.

## Run on Windows

1. Extract the ZIP.
2. Open the *inner* `AgriVerse` folder that contains `server.py`.
3. In PowerShell, run `python server.py`.
4. Visit http://localhost:8899 and press Ctrl+Shift+R to refresh.

## Manual code copy

From the complete package, copy `index.html` into your existing AgriVerse project root and add `assets/combined-journey.css` and `assets/combined-journey.js`. **Back up index.html** first. The updated index references the two new assets. To preserve all features, copy your newer customizations if your local index has diverged from this package.

Existing backend, crop catalog, monthly explorer, Farm Intelligence, and Future Farmer game assets are included. The patch makes no changes to NASA data sources.
