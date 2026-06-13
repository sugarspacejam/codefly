function buildSearchIndex() {
    searchIndex = [];
    for (const node of graphData.nodes) {
        searchIndex.push({ type: 'file', name: node.label, path: node.fullPath, nodeId: node.id });
        if (node.definitions) {
            for (const def of node.definitions) {
                searchIndex.push({ type: def.kind, name: def.name, path: node.fullPath, nodeId: node.id, line: def.line });
            }
        }
    }
    buildPathSearchIndex();
}
