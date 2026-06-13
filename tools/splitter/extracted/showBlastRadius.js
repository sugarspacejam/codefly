window.showBlastRadius = function() {
    if (!selectedNodeId) {
        throw new Error('Select a node first (click it) to see blast radius');
    }
    const transitiveImpact = new Set();
    const queue = [selectedNodeId];
    const visited = new Set([selectedNodeId]);
    let depth = 0;
    while (queue.length > 0 && depth < 3) {
        const next = [];
        for (const id of queue) {
            for (const dep of (adjacencyInList[id] || [])) {
                if (!visited.has(dep)) {
                    visited.add(dep);
                    transitiveImpact.add(dep);
                    next.push(dep);
                }
            }
        }
        queue.length = 0;
        queue.push(...next);
        depth++;
    }
    const impacted = Array.from(transitiveImpact);
    highlightNodes(impacted, `Blast radius of ${selectedNodeId}`);
    setActiveFilterButton('Blast radius (selected node)');
    const container = document.getElementById('analyticsResults');
    const header = document.createElement('div');
    header.style.cssText = 'color:#ff0;margin-bottom:4px;';
    header.textContent = `If you change this file, ${impacted.length} files are impacted:`;
    container.insertBefore(header, container.firstChild);
}
