AGRIVERSE — LIGHT LIQUID-GLASS WIDGETS + DARK MAP ONLY
November 13, 2026

WHAT CHANGED
- Farm Intelligence screen uses the same soft mint background and light top navigation as the rest of AgriVerse.
- Left and right widgets are translucent, pale mint/white liquid glass.
- The deep forest-green styling is confined to the center farm map and its map labels.
- The desktop map remains centered with left/right tabs and no full-page scroll at normal laptop/desktop sizes.
- Mobile layout stacks the widgets and allows vertical scrolling for usability.
- All crop, monthly observation, profit, and map functions are unchanged.

HOW TO RUN
1. Extract the ZIP archive.
2. Open the inner AgriVerse folder containing server.py in VS Code.
3. Open Terminal and run: python server.py
4. Open http://localhost:8899 in your browser and press Ctrl+Shift+R to refresh.

IF YOU ARE MERGING INTO AN EXISTING PROJECT
- Copy assets/dashboard-map-only.css to your assets folder.
- Add this stylesheet AFTER dashboard-focus.css and BEFORE </head> in index.html:
  <link rel="stylesheet" href="assets/dashboard-map-only.css">
- Keep dashboard-focus.js and the earlier files installed.

NOTES
- Satellite imagery requires an internet connection.
- Offline schematic maps are illustrative and labeled as such.
- No live satellite or hazard data are fabricated.
