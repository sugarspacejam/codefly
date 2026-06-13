function getLayoutPositions() {
    if (layoutMode === 'galaxy') return layoutGalaxy(graphData.nodes);
    if (layoutMode === 'filesystem') return layoutFilesystem(graphData.nodes);
    return layoutGraph(graphData.nodes, graphData.edges);
}
