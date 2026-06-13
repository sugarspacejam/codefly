function renderExecutionPathGroup(results, title) {
    const div = document.createElement('div');
    div.className = 'ep-row';
    div.innerHTML = `<span class="ep-kind">${title}</span><div class="ep-path"></div>`;
    results.appendChild(div);
}
