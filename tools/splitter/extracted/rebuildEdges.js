function rebuildEdges() {
    for (const line of edgeLines) {
        const fromMesh = nodeMeshes.get(line.userData.from);
        const toMesh = nodeMeshes.get(line.userData.to);
        if (!fromMesh || !toMesh) continue;
        const positions = line.geometry.attributes.position.array;
        positions[0] = fromMesh.position.x;
        positions[1] = fromMesh.position.y;
        positions[2] = fromMesh.position.z;
        positions[3] = toMesh.position.x;
        positions[4] = toMesh.position.y;
        positions[5] = toMesh.position.z;
        line.geometry.attributes.position.needsUpdate = true;
    }
}
