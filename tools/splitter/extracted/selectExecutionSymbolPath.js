function selectExecutionSymbolPath(symbolEdge, focusNodeId, panelNodeId = null) {
    if (!symbolEdge) return;
    selectedPathEdgeKey = getSymbolEdgeKey(symbolEdge);
    selectedNodeId = panelNodeId || symbolEdge.fromFile;
    highlightExecutionSymbolLane(symbolEdge);
    updateExecutionPathPanel(selectedNodeId);
    const destination = focusNodeId || symbolEdge.toFile;
    if (destination && nodeMeshes.has(destination)) {
        flyToNode(destination);
    }
}
