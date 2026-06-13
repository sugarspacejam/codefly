function getNodeById(nodeId) {
    return graphData.nodes.find((node) => node.id === nodeId) || null;
}
