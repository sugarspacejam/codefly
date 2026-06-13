function saveFolderPref(folder, key, value) {
    const raw = localStorage.getItem(FOLDER_PREFS_KEY);
    let parsed = {};
    if (raw) {
        try {
            parsed = JSON.parse(raw);
        } catch (err) {
            throw new Error(`Invalid folder prefs JSON: ${err.message}`);
        }
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Folder prefs must be an object');
        }
    }
    if (!parsed[folder]) parsed[folder] = {};
    parsed[folder][key] = value;
    localStorage.setItem(FOLDER_PREFS_KEY, JSON.stringify(parsed));
}
