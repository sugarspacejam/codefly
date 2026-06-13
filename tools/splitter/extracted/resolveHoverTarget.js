function resolveHoverTarget(intersects) {
    if (!intersects || intersects.length === 0) {
        return null;
    }

    let target = intersects[0].object;
    while (target && !target.userData.isFileNode && !target.userData.isFunctionNode) {
        target = target.parent;
    }

    if (!target) {
        return null;
    }

    if (target.userData.isFunctionNode) {
        const parentNodeId = target.userData.parentNodeId;
        if (!parentNodeId) {
            return null;
        }
        const parentMesh = nodeMeshes.get(parentNodeId);
        if (!parentMesh || !parentMesh.userData.nodeData) {
            return null;
        }
        return {
            node: parentMesh.userData.nodeData,
            mesh: parentMesh,
            functionMesh: target,
        };
    }

    if (!target.userData.nodeData) {
        return null;
    }

    return {
        node: target.userData.nodeData,
        mesh: target,
        functionMesh: null,
    };
}
