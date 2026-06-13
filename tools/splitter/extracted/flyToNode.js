function flyToNode(nodeId) {
    const mesh = nodeMeshes.get(nodeId);
    if (!mesh) return;
    const target = mesh.position.clone();
    target.z += 20;
    target.y += 5;
    flyTarget.active = true;
    flyTarget.from = playerGroup.position.clone();
    flyTarget.to = target;
    flyTarget.progress = 0;
}
