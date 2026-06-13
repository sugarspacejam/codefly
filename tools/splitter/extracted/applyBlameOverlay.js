function applyBlameOverlay() {
    const authorColors = {};
    const palette = [0x00ff88, 0xff6b6b, 0x5cc8ff, 0xffd700, 0xff8800, 0xcc88ff, 0x88ffcc];
    let colorIdx = 0;
    for (const node of graphData.nodes) {
        const mesh = nodeMeshes.get(node.id);
        if (!mesh) continue;
        const blame = blameByNodeId[node.fullPath];
        if (!blame) {
            mesh.material.color.setHex(0x333333);
            mesh.material.emissiveIntensity = 0.1;
            continue;
        }
        if (!authorColors[blame.author]) {
            authorColors[blame.author] = palette[colorIdx % palette.length];
            colorIdx++;
        }
        mesh.material.color.setHex(authorColors[blame.author]);
        mesh.material.emissiveIntensity = 0.5;
    }
    const container = document.getElementById('analyticsResults');
    container.innerHTML = '<div style="color:#ff0;margin-bottom:6px;">Last author per file:</div>';
    for (const [author, color] of Object.entries(authorColors)) {
        const hex = '#' + color.toString(16).padStart(6, '0');
        const div = document.createElement('div');
        div.className = 'ap-result';
        div.innerHTML = `<span style="color:${hex};">■</span> ${escapeHtml(author)}`;
        container.appendChild(div);
    }
}
