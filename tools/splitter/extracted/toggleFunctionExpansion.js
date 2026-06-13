function toggleFunctionExpansion(nodeId) {
    if (expandedNodes.has(nodeId)) {
        collapseFunctions(nodeId);
    } else {
        expandFunctions(nodeId);
    }
}
