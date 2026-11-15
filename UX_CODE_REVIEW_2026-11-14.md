# AgriVerse — UX and code review patch

Based on the Crop Rotation History project from November 14, 2026.

## Corrections
- Fixed rotation-history panel not appearing after selecting Crop Rotation.
- Kept the crop-discovery banner hidden until the cropping-history form is submitted in rotation mode.
- Made Single Crop bypass cropping-history questions and display the discovery banner.
- Prevented stale crop history from carrying across a change of planting mode.
- Restored consistent handling of HTML hidden sections even where other styles apply flex/grid display.
- Improved text wrapping, line heights, form-label readability, desktop widget scrolling, and phone layouts.
- Shortened dense explanatory descriptions; preserved data uncertainty and transparency labels.

## Installation
To install as a complete project, extract this ZIP and open the inner AgriVerse folder. Run `python server.py`, then browse to http://localhost:8899.

To patch an existing AgriVerse installation, back up these files and copy the patch ZIP's versions into the same paths:
- `index.html`
- `assets/combined-journey.js`
- `assets/ux-review-fixes.css` (new)

The updated index.html loads the new CSS automatically. The rest of the backend and project assets are unchanged.

## Scope
Local JavaScript syntax checks passed for all 11 external JS assets. The backend smoke test passed (98 plants and 6 sourced profiles). Desktop rendering of the farm-profile and rotation-history states was inspected offline. Browser-driven complete navigation and live external APIs were not fully retested. The screenshot used offline fallback imagery and a simulated profile state for layout checking.
