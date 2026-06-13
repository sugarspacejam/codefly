function renderSymbolExecutionRow(results, edge, direction, panelNodeId) {
    const targetId = direction === 'out' ? edge.toFile : edge.fromFile;
    const target = getNodeById(targetId);
    if (!target) return;
    const div = document.createElement('div');
    const edgeKey = getSymbolEdgeKey(edge);
    const kind = direction === 'out' ? 'CALLS' : 'CALLED BY';
    const activeStyle = edgeKey === selectedPathEdgeKey ? ' style="border-color:#6ef5a0;"' : '';
    const label = `${edge.fromSymbol}:${edge.callLine} → ${edge.toSymbol}:${edge.toLine}`;
    const location = `${edge.fromFile}:${edge.callLine} → ${edge.toFile}:${edge.toLine}`;
    div.className = 'ep-row';
    div.innerHTML = `<span class="ep-kind">${kind}</span><span${activeStyle}>${escapeHtml(label)}</span><div class="ep-path">${escapeHtml(location)}</div>`;
    div.onclick = () => selectExecutionSymbolPath(edge, targetId, panelNodeId);
    results.appendChild(div);
}
