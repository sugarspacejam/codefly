function updateFunctionRaycastTargets(nodeId) {
    if (!functionMeshes.has(nodeId)) {
        functionMeshArray = functionMeshArray.filter((mesh) => mesh.userData.parentNodeId !== nodeId);
        updateRaycastTargets();
        return;
    }
    const fnMeshes = functionMeshes.get(nodeId);
    if (!fnMeshes) {
        return;
    }
    for (const { mesh } of fnMeshes) {
        if (!functionMeshArray.includes(mesh)) {
            functionMeshArray.push(mesh);
        }
    }
    updateRaycastTargets();
}
