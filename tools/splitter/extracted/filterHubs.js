window.filterHubs = function() {
    const connections = {};
    for (const e of graphData.edges) {
        connections[e.from] = (connections[e.from] || 0) + 1;
        connections[e.to] = (connections[e.to] || 0) + 1;
    }
    const sorted = Object.entries(connections)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([id]) => id);
    highlightNodes(sorted, 'Top 20 most connected files');
}
