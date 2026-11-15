# AgriVerse — Full-Screen Voxel Future Farmer

## Start

1. Extract the ZIP.
2. Open the **inner `AgriVerse` folder** in VS Code (the folder containing `server.py`).
3. Run `python server.py` in the terminal.
4. Open `http://localhost:8899`, then choose **Future Farmer**.
5. If your browser shows an older version, press `Ctrl+Shift+R`.

## Controls

- **Drag** on the farm to rotate the camera.
- **Scroll** to zoom; **Reset view** restores the original angle.
- **Tap/click a numbered field** to select it.
- **Plant** opens the crop selection and plot management drawer.
- **Care** opens the same drawer with soil/water management options.
- **Grow** advances simulated crop growth; **Harvest** collects mature crops.
- **Mission** opens season goals, soil health, water reserve, game credits and journal.
- **Fullscreen** requests the browser's native full-screen mode. The game already fills the viewport even without it.
- **Sun/Moon** switches the visual day/evening filter.
- **Welcome** exits the game and returns to the normal AgriVerse journey.

## What changed

- Full-viewport, non-scrolling 3D farm scene, including mobile layout.
- Bright, low-poly/voxel-inspired terrain with grid fields, fruit orchard, animals, fences, farmhouse, trees and water channel.
- Translucent controls float over the scene and can be closed so the farm remains fully visible.
- Existing three-season game rules, crop growth, harvesting, resource management and results remain.
- The real **Farmer** journey, crop suitability, farm intelligence and NASA integrations are unchanged.

## Data integrity

Future Farmer is a **fictional educational game**. Its yields, costs, weather, soil and water points are game mechanics, not real observations or agronomic advice. No satellite imagery, external 3D libraries or new Python packages are required for this visual update.

## Manual patch (if you don't want to replace the full project)

Copy these files from the manual patch ZIP into your existing project:

- Replace `assets/future-farmer-3d.js`
- Create `assets/future-farmer-immersive.css`
- Create `assets/future-farmer-immersive.js`

Then add this **after** the existing `future-farmer-3d.css` stylesheet in `index.html`:

```html
<link rel="stylesheet" href="assets/future-farmer-immersive.css">
```

And add this **after** the existing `future-farmer.js` script near the end of `index.html`:

```html
<script src="assets/future-farmer-immersive.js" defer></script>
```

Back up your files before patching. Keep `future-farmer-3d.js` loaded before `future-farmer.js`, and `future-farmer-immersive.js` loaded after it.
