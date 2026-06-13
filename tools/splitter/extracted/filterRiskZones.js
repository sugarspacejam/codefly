window.filterRiskZones = function() {
    const scored = graphData.nodes.map((n) => ({
        id: n.id,
        score: n.lines * (adjacencyIn[n.id] || 0),
    }));
    const sorted = scored.sort((a, b) => b.score - a.score).slice(0, 30).map(s => s.id);
    setActiveFilterButton('Risk zones (large + high fan-in)');
    highlightNodes(sorted, 'Risk zones (size × fan-in)');
}
