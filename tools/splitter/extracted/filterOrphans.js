window.filterOrphans = function() {
    const imported = new Set();
    const imports = new Set();
    for (const e of graphData.edges) {
        imported.add(e.to);
        imports.add(e.from);
    }
    const orphans = graphData.nodes
        .filter(n => !imported.has(n.id) && !imports.has(n.id))
        .map(n => n.id);
    highlightNodes(orphans, 'Orphan files (no imports, not imported)');
}
