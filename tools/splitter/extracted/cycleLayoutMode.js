window.cycleLayoutMode = function() {
    const currentIdx = LAYOUT_MODES.indexOf(layoutMode);
    const nextIdx = (currentIdx + 1) % LAYOUT_MODES.length;
    layoutMode = LAYOUT_MODES[nextIdx];
    rebuildGraphLayout();
    const label = layoutMode.toUpperCase();
    const btn = document.getElementById('layoutModeBtn');
    if (btn) btn.textContent = `Layout: ${label} [L]`;
    const stats = document.getElementById('graphStats');
    if (stats) stats.textContent = `Layout: ${label}`;
    setTimeout(() => { if (stats) stats.textContent = ''; }, 2000);
}
