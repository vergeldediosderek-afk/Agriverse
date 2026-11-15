# AgriVerse — Future Farmer 3D Simulation

## What changed

The Future Farmer mode now has a rotatable, zoomable 3D farm rendered from procedural XYZ geometry using HTML Canvas. It works offline and requires no external JavaScript libraries. The real Farmer mode, satellite integrations, and CropPedia are unchanged.

## Controls

1. From the welcome page choose **Future Farmer**.
2. Drag inside the farm to orbit. Scroll or use + / - to zoom. **Reset view** returns to the starting camera. Keyboard users can use arrow keys on the focused canvas.
3. Select one or more farm plots by clicking the numbered soil beds in the 3D scene, or use the numbered buttons in the right widget. **Select empty** selects every unplanted plot.
4. Choose a crop and click **Plant selected plots**. The selected beds receive seedlings.
5. Click **+1 day** to grow the crops incrementally, or **Watch growth** to automatically advance days until the planted crops mature. Watch the crops change height and leaf shape in the 3D scene.
6. Apply **Mulch**, **Compost**, **Irrigate**, or **Drainage** to change game resources.
7. Click **Harvest ready crops** to earn fictional credits. You can plant a different crop in another empty plot during the same season.
8. After harvesting all planted crops, click **Continue to next season**. Finish three seasons to see the mission score.

## Educational boundaries

All weather, credits, soil scores, crop growth times, costs, and payouts are invented for gameplay and are **not** NASA data, actual yield forecasts, farm-specific advice, or market prices. This simulator is separate from the Farmer crop-suitability decision-support system.

## Manual installation into the latest AgriVerse project

- Replace `index.html` with the included updated file (make a backup first; if your copy has newer custom edits, merge only the Future Farmer section and stylesheet/script references).
- Replace `assets/future-farmer.js`.
- Create `assets/future-farmer-3d.js` and `assets/future-farmer-3d.css`.
- Keep `assets/future-farmer.css`, all other assets, `server.py`, and the Excel database unchanged.
- Start `python server.py` inside the inner `AgriVerse` folder, then open `http://localhost:8899` and hard refresh.

No extra Python or npm dependencies are required.
