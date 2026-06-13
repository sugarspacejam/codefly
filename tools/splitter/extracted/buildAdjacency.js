function buildAdjacency() {
    for (const node of graphData.nodes) {
        adjacencyIn[node.id] = 0;
        adjacencyOut[node.id] = 0;
        adjacencyInList[node.id] = [];
        adjacencyOutList[node.id] = [];
        edgesByNode[node.id] = [];
    }
    for (let i = 0; i < graphData.edges.length; i++) {
        const e = graphData.edges[i];
        adjacencyOut[e.from] = (adjacencyOut[e.from] || 0) + 1;
        adjacencyIn[e.to] = (adjacencyIn[e.to] || 0) + 1;
        if (!adjacencyOutList[e.from]) adjacencyOutList[e.from] = [];
        if (!adjacencyInList[e.to]) adjacencyInList[e.to] = [];
        adjacencyOutList[e.from].push(e.to);
        adjacencyInList[e.to].push(e.from);
        if (!edgesByNode[e.from]) edgesByNode[e.from] = [];
        if (!edgesByNode[e.to]) edgesByNode[e.to] = [];
        edgesByNode[e.from].push(i);
        edgesByNode[e.to].push(i);
        edgesByPair[`${e.from}->${e.to}`] = i;
    }
}
