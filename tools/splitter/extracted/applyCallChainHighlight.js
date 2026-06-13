function applyCallChainHighlight(nodeId) {
    const maxDepth = 3;
    const chain = computeCallChain(nodeId, maxDepth);

    for (const id of chain.nodeIds) {
        const mesh = nodeMeshes.get(id);
        if (mesh) {
            mesh.material.emissiveIntensity = 0.55;
            mesh.scale.setScalar(1.15);
        }
    }

    for (const idx of chain.outboundEdgeIndices) {
        if (edgeLines[idx]) {
            edgeLines[idx].material.opacity = 0.9;
            edgeLines[idx].material.color.setHex(0x00ff88);
        }
    }

    for (const idx of chain.inboundEdgeIndices) {
        if (edgeLines[idx]) {
            edgeLines[idx].material.opacity = 0.85;
            edgeLines[idx].material.color.setHex(0x5cc8ff);
        }
    }

    activeCallChain.nodeId = nodeId;
    activeCallChain.nodeIds = chain.nodeIds;
    activeCallChain.outboundEdgeIndices = chain.outboundEdgeIndices;
    activeCallChain.inboundEdgeIndices = chain.inboundEdgeIndices;
}
