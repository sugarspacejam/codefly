function renderLandmarks() {
    const container = document.getElementById('landmarkList');
    if (!container) {
        return;
    }
    container.innerHTML = '';
    for (const lm of landmarks) {
        const div = document.createElement('div');
        div.className = 'ap-result';
        div.textContent = lm.label;
        div.onclick = () => flyToNode(lm.id);
        container.appendChild(div);
    }
}
