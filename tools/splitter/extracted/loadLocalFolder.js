window.loadLocalFolder = async function() {
    if (!window.showDirectoryPicker) {
        showLoadError('Your browser does not support local folder loading (File System Access API)');
        return;
    }

    const nicknameInput = document.getElementById('nicknameInput');
    if (nicknameInput && nicknameInput.value.trim()) {
        myNickname = nicknameInput.value.trim();
    }

    const localBtn = document.getElementById('localFolderBtn');
    const statusEl = document.getElementById('localFolderStatus');
    if (!localBtn) {
        throw new Error('localFolderBtn element missing from DOM');
    }
    if (!statusEl) {
        throw new Error('localFolderStatus element missing from DOM');
    }

    localBtn.disabled = true;
    statusEl.style.display = 'block';
    statusEl.textContent = 'Opening folder picker...';
    hideLoadError();

    try {
        const directoryHandle = await window.showDirectoryPicker({ mode: 'read' });
        statusEl.textContent = `Selected: ${directoryHandle.name}. Scanning...`;
        const data = await generateGraphFromLocalFolder(directoryHandle, (msg) => {
            statusEl.textContent = msg;
        });
        if (!data || !data.nodes || !data.edges) {
            throw new Error('Local folder graph generation returned no data');
        }

        graphData = data;
        init();

        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('crosshair').style.display = 'block';
        document.getElementById('hud').style.display = 'block';
        document.getElementById('legend').style.display = 'block';
        document.getElementById('minimap').style.display = 'block';
        document.getElementById('chatBox').style.display = 'block';

        gameStarted = true;
        renderer.domElement.requestPointerLock();
        connectMultiplayer();
        buildSearchIndex();
        if (graphData.meta) showLimitations(graphData.meta);
    } catch (err) {
        showLoadError(err.message);
        localBtn.disabled = false;
        statusEl.textContent = '';
        statusEl.style.display = 'none';
    }
}
