window.filterByFolder = function(folder) {
    const ids = graphData.nodes
        .filter(n => n.folder === folder)
        .map(n => n.id);
    highlightNodes(ids, `${folder}/ files`);
}
