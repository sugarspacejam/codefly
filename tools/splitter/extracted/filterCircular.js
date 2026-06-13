window.filterCircular = function() {
    const adj = {};
    for (const e of graphData.edges) {
        if (!adj[e.from]) adj[e.from] = [];
        adj[e.from].push(e.to);
    }
    const inCycle = new Set();
    const visited = new Set();
    const stack = new Set();
    function dfs(node, path) {
        if (stack.has(node)) {
            const cycleStart = path.indexOf(node);
            for (let i = cycleStart; i < path.length; i++) inCycle.add(path[i]);
            return;
        }
        if (visited.has(node)) return;
        visited.add(node);
        stack.add(node);
        path.push(node);
        for (const next of (adj[node] || [])) {
            dfs(next, path);
        }
        path.pop();
        stack.delete(node);
    }
    for (const n of graphData.nodes) dfs(n.id, []);
    highlightNodes([...inCycle], 'Files in circular dependencies');
}
