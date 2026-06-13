window.filterHotPaths = function() {
    const scored = graphData.nodes.map((n) => ({
        id: n.id,
        score: (adjacencyIn[n.id] || 0) + (adjacencyOut[n.id] || 0),
    }));
    const sorted = scored.sort((a, b) => b.score - a.score).slice(0, 30).map(s => s.id);
    setActiveFilterButton('Hot paths (high fan-in/out)');
    highlightNodes(sorted, 'Hot paths (fan-in + fan-out)');
}
