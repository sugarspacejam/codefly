function collapseFunctions(nodeId) {
    expandedNodes.delete(nodeId);
    const fnMeshes = functionMeshes.get(nodeId);
    if (fnMeshes) {
        for (const { mesh, line } of fnMeshes) {
            scene.remove(mesh);
            scene.remove(line);
            mesh.geometry.dispose();
            mesh.material.dispose();
            line.geometry.dispose();
            line.material.dispose();
        }
        functionMeshes.delete(nodeId);
    }
    updateFunctionRaycastTargets(nodeId);
    document.getElementById('functionPanel').style.display = 'none';
}
