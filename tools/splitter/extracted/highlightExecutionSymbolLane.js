function highlightExecutionSymbolLane(symbolEdge) {
    if (!symbolEdge) return;
    resetCallChainHighlight();
    const nodeIds = new Set([symbolEdge.fromFile]);
    if (symbolEdge.toFile && symbolEdge.toFile !== symbolEdge.fromFile) {
        nodeIds.add(symbolEdge.toFile);
    }
    for (const nodeId of nodeIds) {
        const mesh = nodeMeshes.get(nodeId);
        if (!mesh) continue;
        mesh.material.emissiveIntensity = 0.55;
        mesh.scale.setScalar(1.15);
        activeCallChain.nodeIds.add(nodeId);
    }
    const edgeIndex = edgesByPair[`${symbolEdge.fromFile}->${symbolEdge.toFile}`];
    if (edgeIndex === undefined || !edgeLines[edgeIndex]) return;
    edgeLines[edgeIndex].material.opacity = 0.9;
    edgeLines[edgeIndex].material.color.setHex(0x00ff88);
    activeCallChain.outboundEdgeIndices.add(edgeIndex);
}
