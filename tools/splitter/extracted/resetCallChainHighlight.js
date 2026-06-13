function resetCallChainHighlight() {
    for (const nodeId of activeCallChain.nodeIds) {
        const mesh = nodeMeshes.get(nodeId);
        if (mesh) {
            mesh.material.emissiveIntensity = 0.3;
            mesh.scale.setScalar(1);
        }
    }
    for (const idx of activeCallChain.outboundEdgeIndices) {
        if (edgeLines[idx]) {
            edgeLines[idx].material.opacity = 0.25;
            edgeLines[idx].material.color.setHex(0x1a3a5a);
        }
    }
    for (const idx of activeCallChain.inboundEdgeIndices) {
        if (edgeLines[idx]) {
            edgeLines[idx].material.opacity = 0.25;
            edgeLines[idx].material.color.setHex(0x1a3a5a);
        }
    }
    activeCallChain.nodeIds.clear();
    activeCallChain.outboundEdgeIndices.clear();
    activeCallChain.inboundEdgeIndices.clear();
    activeCallChain.nodeId = null;
}
