function computeCallChain(nodeId, maxDepth) {
    const nodeIds = new Set();
    const outboundEdgeIndices = new Set();
    const inboundEdgeIndices = new Set();

    if (!nodeId) {
        return { nodeIds, outboundEdgeIndices, inboundEdgeIndices };
    }

    nodeIds.add(nodeId);

    const traverse = (startId, adjacency, edgeDirection, edgeSet) => {
        const queue = [{ id: startId, depth: 0 }];
        const visited = new Set([startId]);

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            if (current.depth >= maxDepth) {
                continue;
            }
            const nextIds = adjacency[current.id];
            if (!nextIds) {
                continue;
            }
            for (const nextId of nextIds) {
                nodeIds.add(nextId);
                const edgeKey = edgeDirection === 'out' ? `${current.id}->${nextId}` : `${nextId}->${current.id}`;
                const edgeIndex = edgesByPair[edgeKey];
                if (edgeIndex !== undefined) {
                    edgeSet.add(edgeIndex);
                }
                if (!visited.has(nextId)) {
                    visited.add(nextId);
                    queue.push({ id: nextId, depth: current.depth + 1 });
                }
            }
        }
    };

    traverse(nodeId, adjacencyOutList, 'out', outboundEdgeIndices);
    traverse(nodeId, adjacencyInList, 'in', inboundEdgeIndices);

    return { nodeIds, outboundEdgeIndices, inboundEdgeIndices };
}
