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
