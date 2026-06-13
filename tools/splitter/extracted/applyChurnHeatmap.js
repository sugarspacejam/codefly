function applyChurnHeatmap() {
    const ages = [];
    for (const node of graphData.nodes) {
        const dateStr = churnByNodeId[node.id];
        if (!dateStr) continue;
        ages.push(computeCommitAgeDays(dateStr));
    }
    if (ages.length === 0) {
        throw new Error('Churn heatmap unavailable — no commit dates fetched');
    }
    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);
    for (const node of graphData.nodes) {
        const mesh = nodeMeshes.get(node.id);
        if (!mesh) continue;
        const dateStr = churnByNodeId[node.id];
        if (!dateStr) {
            mesh.material.color.setHex(0x555555);
            mesh.material.emissiveIntensity = 0.1;
            mesh.scale.setScalar(0.9);
            continue;
        }
        const age = computeCommitAgeDays(dateStr);
        const t = maxAge === minAge ? 0 : (age - minAge) / (maxAge - minAge);
        _tmpColor.setHSL(0.02 + 0.55 * t, 1, 0.55);
        mesh.material.color.copy(_tmpColor);
        mesh.material.emissive.copy(_tmpColor);
        mesh.material.emissiveIntensity = 0.65;
        mesh.scale.setScalar(1.15);
    }
}
