function showResults(ids, label) {
    const container = document.getElementById('analyticsResults');
    container.innerHTML = `<div style="color:#ff0;margin-bottom:4px;">${label}: ${ids.length}</div>`;
    for (const id of ids.slice(0, 30)) {
        const div = document.createElement('div');
        div.className = 'ap-result';
        div.textContent = id;
        div.onclick = () => flyToNode(id);
        container.appendChild(div);
    }
    if (ids.length > 30) {
        const more = document.createElement('div');
        more.style.color = '#666';
        more.textContent = `... and ${ids.length - 30} more`;
        container.appendChild(more);
    }
}
