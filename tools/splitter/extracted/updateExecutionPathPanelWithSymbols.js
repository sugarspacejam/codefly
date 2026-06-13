function updateExecutionPathPanelWithSymbols(nodeId, node, summary, results, symbolEdges) {
    const outbound = symbolEdges.filter((edge) => edge.fromFile === nodeId).slice(0, 16);
    const inbound = symbolEdges.filter((edge) => edge.toFile === nodeId).slice(0, 16);
    summary.textContent = `${node.fullPath} · ${inbound.length} called by · ${outbound.length} calls`;

    if (inbound.length > 0) {
        renderExecutionPathGroup(results, 'CALLED BY');
        inbound.forEach((edge) => renderSymbolExecutionRow(results, edge, 'in', nodeId));
    }
    if (outbound.length > 0) {
        renderExecutionPathGroup(results, 'CALLS');
        outbound.forEach((edge) => renderSymbolExecutionRow(results, edge, 'out', nodeId));
    }
    if (inbound.length === 0 && outbound.length === 0) {
        renderExecutionPathGroup(results, 'NO SYMBOL PATHS');
    }
}
