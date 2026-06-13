function selectExecutionPathNode(nodeId, shouldFly = true) {
    if (!nodeId || !nodeMeshes.has(nodeId)) return;
    selectedNodeId = nodeId;
    selectedPathEdgeKey = null;
    resetCallChainHighlight();
    applyCallChainHighlight(nodeId);
    updateExecutionPathPanel(nodeId);
    if (shouldFly) {
        flyToNode(nodeId);
    }
}
