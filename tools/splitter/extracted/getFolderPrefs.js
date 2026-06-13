function getFolderPrefs(folder) {
    const raw = localStorage.getItem(FOLDER_PREFS_KEY);
    if (!raw) return {};
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        throw new Error(`Invalid folder prefs JSON: ${err.message}`);
    }
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Folder prefs must be an object');
    }
    return parsed[folder] || {};
}
