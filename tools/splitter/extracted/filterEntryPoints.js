window.filterEntryPoints = function() {
    const sorted = [...graphData.nodes]
        .sort((a, b) => (adjacencyOut[b.id] || 0) - (adjacencyOut[a.id] || 0))
        .slice(0, 30)
        .map(n => n.id);
    setActiveFilterButton('Entry points (top outbound)');
    highlightNodes(sorted, 'Entry points (top outbound)');
}
