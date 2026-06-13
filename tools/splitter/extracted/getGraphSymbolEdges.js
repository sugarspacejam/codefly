function getGraphSymbolEdges() {
    if (!graphData || !Array.isArray(graphData.symbolEdges)) return [];
    if (graphData.symbolEdges.length === 0) return [];
    return graphData.symbolEdges;
}
