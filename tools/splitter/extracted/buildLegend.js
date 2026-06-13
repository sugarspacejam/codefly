function buildLegend() {
    const folders = new Set(graphData.nodes.map(n => n.folder));
    const container = document.getElementById('legendItems');
    container.innerHTML = '';
    for (const folder of folders) {
        const color = getFolderColor(folder);
        const hex = '#' + new THREE.Color(color).getHexString();
        const div = document.createElement('div');
        div.className = 'legend-item';
        div.innerHTML = `<div class="legend-dot" style="background:${hex}"></div>${folder}/`;
        container.appendChild(div);
    }

    // Language legend
    if (graphData.meta && graphData.meta.languages) {
        const langDiv = document.createElement('div');
        langDiv.style.marginTop = '8px';
        langDiv.style.borderTop = '1px solid #333';
        langDiv.style.paddingTop = '6px';
        langDiv.innerHTML = '<div style="font-weight:bold;color:#fff;margin-bottom:4px">LANGUAGES</div>';
        for (const [lang, count] of Object.entries(graphData.meta.languages)) {
            const lc = LANG_COLORS[lang] || 0x888888;
            const hex = '#' + new THREE.Color(lc).getHexString();
            const d = document.createElement('div');
            d.className = 'legend-item';
            d.innerHTML = `<div class="legend-dot" style="background:${hex}"></div>${lang} (${count})`;
            langDiv.appendChild(d);
        }
        container.appendChild(langDiv);
    }
}
