window.filterApiSurface = function() {
    const sorted = [...graphData.nodes]
        .sort((a, b) => (adjacencyIn[b.id] || 0) - (adjacencyIn[a.id] || 0))
        .slice(0, 30)
        .map(n => n.id);
    setActiveFilterButton('API surface (high fan-in)');
    highlightNodes(sorted, 'API surface (top fan-in)');
}
