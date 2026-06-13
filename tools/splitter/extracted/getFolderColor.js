function getFolderColor(folder) {
    const lower = folder.toLowerCase();
    for (const [key, color] of Object.entries(FOLDER_COLORS)) {
        if (lower.includes(key)) return color;
    }
    let hash = 0;
    for (let i = 0; i < folder.length; i++) {
        hash = folder.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (hash & 0x00FFFFFF);
}
