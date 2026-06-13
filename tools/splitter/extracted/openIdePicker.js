function openIdePicker(node, line) {
    if (!node) {
        throw new Error('openIdePicker requires a node');
    }
    const modal = document.getElementById('idePickerModal');
    const pathEl = document.getElementById('idePickerPath');
    const btnsEl = document.getElementById('idePickerButtons');
    if (!modal || !pathEl || !btnsEl) {
        throw new Error('IDE picker modal elements missing');
    }
    const lineNumber = line || 1;
    const isRemote = !!(graphData && graphData.meta && graphData.meta.provider && graphData.meta.provider !== 'local');
    pathEl.textContent = node.fullPath + `:${lineNumber}`;
    btnsEl.innerHTML = '';

    if (isRemote) {
        const repoMeta = graphData.meta;
        let remoteUrl = null;
        if (repoMeta.provider === 'github' && repoMeta.repo && repoMeta.branch) {
            remoteUrl = `https://github.com/${repoMeta.repo}/blob/${repoMeta.branch}/${node.fullPath}#L${lineNumber}`;
        } else if (repoMeta.provider === 'gitlab' && repoMeta.repo && repoMeta.branch) {
            remoteUrl = `https://gitlab.com/${repoMeta.repo}/-/blob/${repoMeta.branch}/${node.fullPath}#L${lineNumber}`;
        }

        if (remoteUrl) {
            const viewBtn = document.createElement('button');
            viewBtn.className = 'ide-btn';
            viewBtn.innerHTML = `<span class="ide-icon">🌐</span> View on ${repoMeta.provider === 'github' ? 'GitHub' : 'GitLab'}`;
            viewBtn.onclick = () => { window.open(remoteUrl, '_blank'); closeIdePicker(); };
            btnsEl.appendChild(viewBtn);
        }

        const copyBtn = document.createElement('button');
        copyBtn.className = 'ide-btn';
        copyBtn.innerHTML = `<span class="ide-icon">📋</span> Copy file path`;
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(node.fullPath);
            copyBtn.innerHTML = `<span class="ide-icon">✅</span> Copied!`;
            setTimeout(() => closeIdePicker(), 1200);
        };
        btnsEl.appendChild(copyBtn);

        const noteEl = document.createElement('div');
        noteEl.style.cssText = 'color:#555;font-size:10px;margin-top:10px;line-height:1.5;';
        noteEl.textContent = 'To open in your local IDE, clone the repo first.';
        btnsEl.appendChild(noteEl);
    } else {
        for (const editor of IDE_EDITORS) {
            const btn = document.createElement('button');
            btn.className = 'ide-btn';
            btn.innerHTML = `<span class="ide-icon">${editor.icon}</span> ${editor.label}`;
            btn.onclick = () => openInEditor(editor, node, lineNumber);
            btnsEl.appendChild(btn);
        }
    }
    modal.style.display = 'block';
    document.exitPointerLock();
}
