function openFolderSettings() {
    if (!gameStarted) {
        throw new Error('openFolderSettings: game not started');
    }
    if (!graphData) {
        throw new Error('openFolderSettings: no graph data loaded');
    }

    const panel = document.getElementById('folderSettingsPanel');
    const list = document.getElementById('folderSettingsList');
    if (!panel || !list) {
        throw new Error('Folder settings panel elements missing from DOM');
    }

    const folders = [...new Set(graphData.nodes.map((n) => n.folder))].sort();
    list.innerHTML = '';

    for (const folder of folders) {
        const prefs = getFolderPrefs(folder);
        const defaultColorHex = '#' + getFolderColor(folder).toString(16).padStart(6, '0');
        const nodeCount = graphData.nodes.filter((n) => n.folder === folder).length;

        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:10px; margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid #111;';

        const nameEl = document.createElement('span');
        nameEl.style.cssText = 'color:#ccc; font-size:12px; width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex-shrink:0;';
        nameEl.textContent = `${folder} (${nodeCount})`;
        nameEl.title = folder;

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = prefs.color || defaultColorHex;
        colorInput.style.cssText = 'width:32px; height:26px; border:none; cursor:pointer; border-radius:4px; flex-shrink:0;';
        colorInput.title = 'Change folder color';
        colorInput.oninput = () => setFolderColor(folder, colorInput.value);

        const shapeSelect = document.createElement('select');
        shapeSelect.style.cssText = 'background:#111; color:#ccc; border:1px solid #333; border-radius:4px; padding:3px 6px; font-family:Courier New,monospace; font-size:11px; flex-shrink:0;';
        shapeSelect.title = 'Change node shape';
        for (const shape of ['sphere', 'cube', 'diamond', 'cylinder']) {
            const opt = document.createElement('option');
            opt.value = shape;
            opt.textContent = shape;
            if ((prefs.shape || 'sphere') === shape) opt.selected = true;
            shapeSelect.appendChild(opt);
        }
        shapeSelect.onchange = () => setFolderShape(folder, shapeSelect.value);

        const toggleBtn = document.createElement('button');
        const isCollapsed = collapsedFolders.has(folder);
        toggleBtn.textContent = isCollapsed ? 'Show' : 'Hide';
        toggleBtn.style.cssText = 'padding:3px 10px; background:transparent; color:#888; border:1px solid #444; border-radius:4px; cursor:pointer; font-family:Courier New,monospace; font-size:10px; flex-shrink:0;';
        toggleBtn.onclick = () => {
            toggleFolderCollapse(folder);
            toggleBtn.textContent = collapsedFolders.has(folder) ? 'Show' : 'Hide';
        };

        row.appendChild(nameEl);
        row.appendChild(colorInput);
        row.appendChild(shapeSelect);
        row.appendChild(toggleBtn);
        list.appendChild(row);
    }

    panel.style.display = 'block';
    document.exitPointerLock();
}
