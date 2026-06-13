function layoutGraph(nodes, edges) {
    const folders = {};
    for (const node of nodes) {
        if (!folders[node.folder]) folders[node.folder] = [];
        folders[node.folder].push(node);
    }

    const folderNames = Object.keys(folders);
    const folderCount = folderNames.length;

    const folderPositions = {};
    const folderRadius = folderCount * SPREAD * 1.2;
    folderNames.forEach((name, i) => {
        const angle = (i / folderCount) * Math.PI * 2;
        folderPositions[name] = {
            x: Math.cos(angle) * folderRadius,
            z: Math.sin(angle) * folderRadius,
            y: 0
        };
    });

    const positions = {};
    for (const [folder, folderNodes] of Object.entries(folders)) {
        const center = folderPositions[folder];
        const count = folderNodes.length;
        const clusterRadius = Math.sqrt(count) * SPREAD * 0.6;

        folderNodes.forEach((node, i) => {
            const t = i / Math.max(count - 1, 1);
            const spiralAngle = t * Math.PI * 6;
            const spiralRadius = t * clusterRadius;
            const yOffset = (Math.random() - 0.5) * LAYER_HEIGHT;

            positions[node.id] = {
                x: center.x + Math.cos(spiralAngle) * spiralRadius,
                y: center.y + yOffset,
                z: center.z + Math.sin(spiralAngle) * spiralRadius
            };
        });
    }

    for (let iter = 0; iter < 3; iter++) {
        const nodeIds = Object.keys(positions);
        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                const a = positions[nodeIds[i]];
                const b = positions[nodeIds[j]];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dz = b.z - a.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist < SPREAD * 1.5 && dist > 0.01) {
                    const force = (SPREAD * 1.5 - dist) * 0.3;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const nz = dz / dist;
                    a.x -= nx * force;
                    a.y -= ny * force;
                    a.z -= nz * force;
                    b.x += nx * force;
                    b.y += ny * force;
                    b.z += nz * force;
                }
            }
        }
    }

    return { positions, folderPositions };
}
