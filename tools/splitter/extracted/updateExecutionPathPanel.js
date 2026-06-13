function updateExecutionPathPanel(nodeId) {
    const panel = document.getElementById('executionPathPanel');
    const summary = document.getElementById('executionPathSummary');
    const results = document.getElementById('executionPathResults');
    const node = getNodeById(nodeId);
    if (!panel || !summary || !results || !node) return;

    results.innerHTML = '';
    const current = document.createElement('div');
    current.className = 'ep-row';
    current.innerHTML = `<span class="ep-kind">SELECTED</span>${escapeHtml(getPrimaryDefinitionLabel(node))}<div class="ep-path">${escapeHtml(node.fullPath)}</div>`;
    current.onclick = () => flyToNode(nodeId);
    results.appendChild(current);

    const symbolEdges = getGraphSymbolEdges();
    if (symbolEdges.length > 0) {
        updateExecutionPathPanelWithSymbols(nodeId, node, summary, results, symbolEdges);
    } else {
        updateExecutionPathPanelFallback(nodeId, node, summary, results);
    }

    panel.style.display = 'block';
}
