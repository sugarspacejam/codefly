function updateFunctionPanel(node) {
    const panel = document.getElementById('functionPanel');
    const list = document.getElementById('functionList');
    const parseMeta = getParseStatusMeta(getNodeParseStatus(node));
    panel.style.display = 'block';
    document.getElementById('functionFileName').textContent = node.fullPath;
    document.getElementById('functionCount').textContent = `${node.definitions.length} definitions · ${parseMeta.label}`;

    list.innerHTML = '';
    for (const def of node.definitions) {
        const div = document.createElement('div');
        div.className = 'fn-item';
        const kindTag = def.kind === 'class' ? 'cls' : def.kind === 'variable' ? 'var' : 'fn';
        const kindClr = def.kind === 'class' ? '#0cf' : def.kind === 'variable' ? '#c6f' : '#f80';
        div.innerHTML = `<span style="color:${kindClr}">[${kindTag}]</span> <span class="fn-name">${escapeHtml(def.name)}</span><span class="fn-line">:${def.line}</span>`;
        div.onclick = () => openIdePicker(node, def.line);
        list.appendChild(div);
    }
}
