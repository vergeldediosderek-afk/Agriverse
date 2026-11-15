# AgriVerse — Future Farmer: Sprig & Disaster Preparedness

## Run on Windows

1. Extract the entire ZIP. Open the **AgriVerse** folder containing `server.py` and `index.html`.
2. Open a terminal in that folder and run `python server.py`.
3. Visit `http://localhost:8899` and choose **Future Farmer**.
4. Keep the terminal open. Press Ctrl+C to stop the server.

No Python packages or external 3D libraries are required for the educational game. Internet access is needed for aerial imagery when mapping a real plot.

## Start a farm

- **Practice landscape:** Choose Lowland, Hillside, or Riverside, then Start practice farm. These are fictional practice scenarios, not measured field conditions.
- **Map my own plot:** Choose an island, enter a location, and outline your field on the map. Confirm the boundary. Future Farmer reopens with your location, estimated area, and saved polygon footprint. The 3D world remains a stylized illustration; it is **not an exact terrain reconstruction**.
- If the map cannot load, the demo outline must be explicitly acknowledged and is labeled simulated.

## Play

- **Sprig** is the green plant companion. Click Sprig to replay mission instructions and hints.
- **Mission** on the bottom toolbar opens Sprig's mission guide.
- **Plant** opens crop and plot controls; choose a crop, select one or more plots, then plant.
- **Grow** advances simulated days. At Day 3, the game pauses for a fictional hazard warning.
- Choose a preparedness action in Sprig's dialogue. Costs and consequences are simulated game values.
- At Day 5, the hazard is applied to the game's soil, water, and crop stress. Sprig explains the outcome.
- Harvest mature crops, manage resources, and advance through three seasons. Try different choices to compare outcomes.
- **Care** opens resource management actions. **Details** shows the farm's mapped or simulated context.
- Swipe horizontally on the farm to switch between preset isometric views; scroll to zoom. This avoids the old free-rotation lag and perspective distortion.

## Educational scenarios

| Season | Fictional event | Example preparations |
|---|---|---|
| 1 | Dry spell | Mulch, plan irrigation, or take no action |
| 2 | Heavy rain/flooding; hillside erosion for hillside practice farm | Improve drainage or soil cover |
| 3 | Strong winds | Secure supports or protect young plants |

The game uses **fictional** weather, costs, yield effects, crop stress and scoring. It does **not** provide real-time PAGASA warnings, NASA forecasts, exact farm-specific soil measurements, or validated economic projections.

## Future real-data integration

The farm boundary and optional farmer-entered context can be passed to `window.AVFutureSim.configureFarm(context)` through the existing mapping workflow. To create a genuine plot-based digital terrain model later, the project will need validated DEM elevation/slope data, soil surveys or field tests, water information, hazard maps and documented agronomic rules. This edition **does not fetch or invent those datasets**.

### Files added or updated

- `assets/future-farmer-adventure.js` — mascot, setup, dialogs, event responses.
- `assets/future-farmer-adventure.css` — mascot, setup and dialogue styling.
- `assets/future-farmer.js` — game state, scripted disaster choices, consequences and events.
- `assets/future-farmer-3d.js` — performance improvements, preset camera angles, illustrative terrain variants.
- `assets/future-farmer-immersive.js` — Mission button and panel-scrolling fix.
- `index.html` — Future Farmer mapped-plot routing and asset references.

The real Farmer mode, CropPedia, smart plot screening, Farm Intelligence dashboard and existing backend are preserved.
