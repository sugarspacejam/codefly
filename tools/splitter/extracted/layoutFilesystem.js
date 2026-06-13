function layoutFilesystem(nodes) {
    const positions = {};
    const folderPositions = {};
    const folders = {};
    for (const node of nodes) {
        if (!folders[node.folder]) folders[node.folder] = [];
        folders[node.folder].push(node);
    }
    const folderNames = Object.keys(folders).sort();
    const columnSpacing = SPREAD * 3;
    const rowSpacing = 2.2;
    const startX = -(folderNames.length - 1) * columnSpacing * 0.5;

    folderNames.forEach((folder, i) => {
        const x = startX + i * columnSpacing;
        folderPositions[folder] = { x, y: 0, z: 0 };
        const folderNodes = folders[folder].slice().sort((a, b) => a.label.localeCompare(b.label));
        folderNodes.forEach((node, idx) => {
            positions[node.id] = {
                x,
                y: idx * rowSpacing,
                z: 0,
            };
        });
    });

    return { positions, folderPositions };
}
