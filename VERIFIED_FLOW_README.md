# AgriVerse — Verified Farmer Journey Fix (November 14, 2026)

## What changed
- The existing `Find approximate location & plot` button requests a map starting point (or uses the city-level fallback) and opens the **same screen's** interactive plotting stage.
- A real transition animates the location panel sliding left and the regional map preview morphing toward the plotting map.
- Confirming a polygon opens **land specifications first**, with Single Crop and Crop Rotation choices immediately below.
- Crop Rotation opens the prior-crop history form; the recommendation banner appears **only after** that form is submitted, including an "I don't know" option.
- Single Crop opens the candidate banner without asking for rotation history.
- The crop banner links to the existing analysis screen and then Farm Intelligence.
- Compact screen-specific styles improve text wrapping and sidebar spacing.
- Real suitability rankings, soil nutrients, field-scale moisture, and terrain data are **not** automatically supplied or simulated.

## Files modified
- index.html (geocoding timeout, button text, crop discovery banner, stylesheet reference)
- assets/combined-journey.js (real animated transition and state handling)
- assets/verified-flow.css (new visual and spacing adjustments)

## Start on Windows
1. Extract the ZIP. Open the inner `AgriVerse` folder in VS Code.
2. Run `python server.py` in that folder.
3. Open `http://localhost:8899` and hard-refresh with `Ctrl+Shift+R`.

## Expected farmer experience
Farmer -> Mindanao -> province/city/barangay/purok -> Find approximate location & plot -> draw at least three corners -> confirm -> land specifications -> choose single/rotation -> crop history if rotation -> candidate banner -> analyze suitable crops -> Farm Intelligence.

## Verification scope
Playwright Chromium OFFLINE tests were run at 1440x900, 1366x768 and 390x844 using a simulated geocoding response. Tests checked expected stages, boundary demo acknowledgments, crop-history gating, navigation to analysis and JavaScript page errors. Additional offline tests covered incomplete location form, geocoding failure fallback, Single Crop, unknown previous crop, and resetting crop mode. The external geocoder, real map tiles, live NASA API and actual plotted-field satellite interaction were NOT verified in those offline tests. Run the live website in your local browser to validate them.
