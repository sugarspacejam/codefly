window.filterLargest = function() {
    const sorted = [...graphData.nodes]
        .sort((a, b) => b.lines - a.lines)
        .slice(0, 20)
        .map(n => n.id);
    highlightNodes(sorted, 'Top 20 largest files');
}
