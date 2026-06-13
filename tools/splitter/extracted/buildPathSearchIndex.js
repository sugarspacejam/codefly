function buildPathSearchIndex() {
    pathSearchIndex = [];
    const symbolEdges = getGraphSymbolEdges();
    if (symbolEdges.length > 0) {
        for (const edge of symbolEdges) {
            pathSearchIndex.push({
                type: 'path',
                name: `${edge.fromSymbol} → ${edge.toSymbol}`,
                path: `${edge.fromFile}:${edge.callLine} → ${edge.toFile}:${edge.toLine}`,
                fromId: edge.fromFile,
                toId: edge.toFile,
                nodeId: edge.fromFile,
                symbolEdge: edge,
            });
        }
        return;
    }

    for (const edge of graphData.edges) {
        const from = getNodeById(edge.from);
        const to = getNodeById(edge.to);
        if (!from || !to) continue;
        const fromLabel = getPrimaryDefinitionLabel(from);
        const toLabel = getPrimaryDefinitionLabel(to);
        pathSearchIndex.push({
            type: 'path',
            name: `${fromLabel} → ${toLabel}`,
            path: `${from.fullPath} → ${to.fullPath}`,
            fromId: from.id,
            toId: to.id,
            nodeId: from.id,
        });
    }
}
