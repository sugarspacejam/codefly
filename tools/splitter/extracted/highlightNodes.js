function highlightNodes(matchingIds, resultLabel) {
    const matchSet = new Set(matchingIds);
    for (const [id, mesh] of nodeMeshes) {
        if (matchSet.has(id)) {
            mesh.material.opacity = 1;
            mesh.material.emissiveIntensity = 0.8;
            mesh.material.transparent = false;
            mesh.scale.setScalar(1.5);
        } else {
            mesh.material.opacity = 0.08;
            mesh.material.emissiveIntensity = 0.05;
            mesh.material.transparent = true;
            mesh.scale.setScalar(0.5);
        }
    }
    for (const line of edgeLines) {
        const fromMatch = matchSet.has(line.userData.from);
        const toMatch = matchSet.has(line.userData.to);
        if (fromMatch && toMatch) {
            line.material.opacity = 0.8;
            line.material.color.setHex(0x00ff88);
        } else if (fromMatch || toMatch) {
            line.material.opacity = 0.15;
            line.material.color.setHex(0x1a3a5a);
        } else {
            line.material.opacity = 0.02;
            line.material.color.setHex(0x1a3a5a);
        }
    }
    showResults(matchingIds, resultLabel);
}
