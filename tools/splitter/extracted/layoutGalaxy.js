function layoutGalaxy(nodes) {
    const positions = {};
    const folderPositions = {};
    const folders = {};
    for (const node of nodes) {
        if (!folders[node.folder]) folders[node.folder] = [];
        folders[node.folder].push(node);
    }
    const folderNames = Object.keys(folders);
    const folderCount = folderNames.length;
    const baseRadius = folderCount * SPREAD * 0.9;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    folderNames.forEach((folder, i) => {
        const r = baseRadius * (0.6 + i / Math.max(folderCount - 1, 1));
        const angle = i * goldenAngle;
        folderPositions[folder] = { x: Math.cos(angle) * r, y: 0, z: Math.sin(angle) * r };
    });

    for (const [folder, folderNodes] of Object.entries(folders)) {
        const center = folderPositions[folder];
        const count = folderNodes.length;
        const spiralRadius = Math.sqrt(count) * SPREAD * 0.7;
        folderNodes.forEach((node, i) => {
            const t = i / Math.max(count - 1, 1);
            const angle = t * Math.PI * 8;
            const r = t * spiralRadius;
            positions[node.id] = {
                x: center.x + Math.cos(angle) * r,
                y: (i % 7) * 1.2,
                z: center.z + Math.sin(angle) * r,
            };
        });
    }

    return { positions, folderPositions };
}
