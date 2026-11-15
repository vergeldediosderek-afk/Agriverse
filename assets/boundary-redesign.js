/* AgriVerse boundary UI. Existing Leaflet polygon + saved coordinates remain the source of truth. */
(function () {
  'use strict';
  const el = (id) => document.getElementById(id);
  function sync(count, area, demo, points) {
    const n = Number(count) || 0;
    const hectares = Number(area) || 0;
    const ready = n >= 3 && hectares > 0;
    const status = el('avb-boundary-status');
    const statusText = el('avb-status-text');
    const confirm = el('confirm-field');
    const hint = el('avb-corner-hint');
    const sqm = el('avb-area-m2');
    const demoWarning = el('avb-demo-warning');
    if (confirm) confirm.disabled = !ready;
    if (hint) hint.textContent = n < 3 ? `${n} of 3 minimum` : `${n} corners selected`;
    if (sqm) sqm.textContent = ready
      ? `≈ ${(hectares * 10000).toLocaleString('en-PH', {maximumFractionDigits: 0})} m²`
      : 'Draw at least 3 corners';
    if (status) status.classList.toggle('is-ready', ready && !demo);
    if (statusText) statusText.textContent = demo
      ? (ready ? 'Demo only · not a verified field' : 'Demo mode · mark at least 3 corners')
      : ready ? 'Boundary ready for review' : n === 0
      ? 'Waiting for your first corner' : `${3 - n} more corner${3 - n === 1 ? '' : 's'} needed`;
    if (demoWarning) demoWarning.hidden = !demo;
    if (!window.L) setImageryAvailable(false);
    // Offline-only illustration of the chosen polygon, never a satellite observation.
    const outline = el('avb-offline-shape');
    const poly = el('avb-offline-polygon');
    const dots = el('avb-offline-dots');
    const fallback = el('farm-map-fallback');
    const isOffline = !window.L || (fallback && fallback.style.display === 'grid');
    const vertices = Array.isArray(points) ? points : [];
    if (outline) outline.classList.toggle('is-visible', Boolean(isOffline && vertices.length));
    if (poly && dots) {
      if (vertices.length) {
        const lats = vertices.map(p => p[0]), lons = vertices.map(p => p[1]);
        const latMid = (Math.min(...lats) + Math.max(...lats)) / 2;
        const lonMid = (Math.min(...lons) + Math.max(...lons)) / 2;
        const latRange = Math.max(.0001, Math.max(...lats) - Math.min(...lats));
        const lonRange = Math.max(.0001, Math.max(...lons) - Math.min(...lons));
        const scale = Math.min(400 / lonRange, 260 / latRange);
        const projected = vertices.map(([lat,lon]) => [500+(lon-lonMid)*scale, 340-(lat-latMid)*scale]);
        poly.setAttribute('points', projected.length >= 3 ? projected.map(p => p.join(',')).join(' ') : '');
        dots.innerHTML = projected.map(([x,y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9"/>`).join('');
      } else { poly.setAttribute('points',''); dots.replaceChildren(); }
    }
    for (let i = 1; i <= 3; i++) {
      const step = el('avb-step-' + i);
      if (!step) continue;
      step.classList.toggle('is-current', (i === 1 && n === 0) || (i === 2 && n > 0 && n < 3) || (i === 3 && ready));
      step.classList.toggle('is-done', (i === 1 && n > 0) || (i === 2 && ready));
    }
    const undo = el('map-undo');
    const reset = el('map-reset');
    if (undo) undo.disabled = n === 0;
    if (reset) reset.disabled = n === 0;
  }
  function setImageryAvailable(available) {
    const label = el('avb-imagery-chip-label');
    if (label) label.textContent = available ? 'SATELLITE VIEW' : 'IMAGERY UNAVAILABLE';
    const guide = el('avb-map-guide-text');
    if (guide) guide.textContent = available ? 'Click corners · drag to adjust' : 'Use demo only until imagery loads';
  }
  window.AVBoundary = { sync, setImageryAvailable };
  // Initialize before the map receives any points.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => sync(0, 0, false), {once:true});
  } else sync(0, 0, false);
})();
