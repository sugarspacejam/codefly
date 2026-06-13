function applyFolderCollapse() {
    for (const node of graphData.nodes) {
        const mesh = nodeMeshes.get(node.id);
        if (!mesh) continue;
        const isCollapsed = collapsedFolders.has(node.folder);
        mesh.visible = !isCollapsed;
    }
    for (const line of edgeLines) {
        const fromMesh = nodeMeshes.get(line.userData.from);
        const toMesh = nodeMeshes.get(line.userData.to);
        line.visible = !!(fromMesh && toMesh && fromMesh.visible && toMesh.visible);
    }
}
