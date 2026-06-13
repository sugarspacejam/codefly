function toggleFolderCollapse(folder) {
    if (!folder) {
        throw new Error('toggleFolderCollapse requires a folder name');
    }
    if (collapsedFolders.has(folder)) {
        collapsedFolders.delete(folder);
    } else {
        collapsedFolders.add(folder);
    }
    applyFolderCollapse();
}
