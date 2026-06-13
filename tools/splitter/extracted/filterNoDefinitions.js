window.filterNoDefinitions = function() {
    const ids = graphData.nodes
        .filter(n => !n.definitions || n.definitions.length === 0)
        .map(n => n.id);
    highlightNodes(ids, 'Files with no definitions');
}
