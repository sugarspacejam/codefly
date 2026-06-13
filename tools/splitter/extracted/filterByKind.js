window.filterByKind = function(kind) {
    const ids = graphData.nodes
        .filter(n => n.definitions && n.definitions.some(d => d.kind === kind))
        .map(n => n.id);
    highlightNodes(ids, `Files containing ${kind}s`);
}
