function updateExecutionPathPanelFallback(nodeId, node, summary, results) {
    const outbound = (adjacencyOutList[nodeId] || []).slice(0, 12);
    const inbound = (adjacencyInList[nodeId] || []).slice(0, 12);
    summary.textContent = `${node.fullPath} · ${inbound.length} callers/dependents · ${outbound.length} calls/dependencies`;

    const renderRow = (kind, targetId) => {
        const target = getNodeById(targetId);
        if (!target) return;
        const div = document.createElement('div');
        div.className = 'ep-row';
        div.innerHTML = `<span class="ep-kind">${kind}</span>${escapeHtml(getPrimaryDefinitionLabel(target))}<div class="ep-path">${escapeHtml(target.fullPath)}</div>`;
        div.onclick = () => selectExecutionPathNode(targetId, true);
        results.appendChild(div);
    };

    inbound.forEach((id) => renderRow('IN', id));
    outbound.forEach((id) => renderRow('OUT', id));
}
