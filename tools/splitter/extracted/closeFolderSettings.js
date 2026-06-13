window.closeFolderSettings = function() {
    const panel = document.getElementById('folderSettingsPanel');
    if (!panel) {
        throw new Error('folderSettingsPanel element missing from DOM');
    }
    panel.style.display = 'none';
}
