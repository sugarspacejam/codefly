function addLandmark(node) {
    if (!node || !node.id) {
        throw new Error('Cannot add landmark without node');
    }
    if (landmarks.some((lm) => lm.id === node.id)) {
        return;
    }
    landmarks.push({ id: node.id, label: node.label, path: node.fullPath });
    persistLandmarks();
    renderLandmarks();
}
