function rebuildGraphLayout() {
    const { positions } = getLayoutPositions();
    for (const [id, mesh] of nodeMeshes) {
        const pos = positions[id];
        if (!pos) continue;
        mesh.userData.targetPos = new THREE.Vector3(pos.x, pos.y, pos.z);
        mesh.userData.baseY = pos.y;
    }
    rebuildEdges();
    applyFolderCollapse();
}
