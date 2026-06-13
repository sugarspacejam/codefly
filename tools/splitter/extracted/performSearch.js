function performSearch(query) {
    const results = document.getElementById('searchResults');
    results.innerHTML = '';
    if (!query || query.length < 2) return;

    if (query.trim().startsWith('?')) {
        const intentQuery = query.trim().slice(1).trim();
        if (intentQuery.length < 2) return;
        const target = resolveIntentTarget(intentQuery);
        if (!target) {
            results.innerHTML = '<div class="search-result" style="color:#666;">No intent match. Try auth, payments, onboarding, notifications, api, data.</div>';
            return;
        }
        const div = document.createElement('div');
        div.className = 'search-result';
        div.textContent = `Jump to: ${target.label}`;
        div.onclick = () => {
            flyToNode(target.id);
            closeSearch();
        };
        results.appendChild(div);
        return;
    }

    const q = query.toLowerCase();
    const source = searchIndex.concat(pathSearchIndex);
    const matches = source
        .filter(item => item.name.toLowerCase().includes(q) || item.path.toLowerCase().includes(q))
        .slice(0, 30);

    for (const match of matches) {
        const div = document.createElement('div');
        div.className = 'search-result';
        const kindLabel = match.type === 'file' ? 'FILE' : match.type === 'function' ? 'FN' : match.type === 'class' ? 'CLS' : match.type === 'path' ? 'PATH' : 'VAR';
        const lineInfo = match.line ? `:${match.line}` : '';
        div.innerHTML = `<span class="sr-kind">[${kindLabel}]</span> ${escapeHtml(match.name)} <span class="sr-file">${escapeHtml(match.path)}${lineInfo}</span>`;
        div.onclick = () => {
            if (match.type === 'path' && match.symbolEdge) {
                selectExecutionSymbolPath(match.symbolEdge, match.toId, match.fromId);
            } else if (match.type === 'path') {
                selectExecutionPathNode(match.fromId, true);
            } else {
                flyToNode(match.nodeId);
                selectExecutionPathNode(match.nodeId, false);
            }
            closeSearch();
        };
        results.appendChild(div);
    }
}
