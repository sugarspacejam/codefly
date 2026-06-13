function showNodeFallbackPanel(node) {
    const panel = document.getElementById('functionPanel');
    const list = document.getElementById('functionList');
    const parseMeta = getParseStatusMeta(getNodeParseStatus(node));
    const parseReason = node.parseReason || 'No parser details available';
    const previewLines = getNodePreviewLines(node);
    const previewHtml = previewLines.length > 0
        ? `<div style="margin-top:8px; color:#aaa; font-size:11px; line-height:1.5;">${previewLines.map((line) => escapeHtml(line)).join('<br>')}</div>`
        : '<div style="margin-top:8px; color:#666; font-size:11px;">No preview available.</div>';

    panel.style.display = 'block';
    document.getElementById('functionFileName').textContent = node.fullPath;
    document.getElementById('functionCount').textContent = `0 definitions · ${parseMeta.label}`;
    list.innerHTML = `
        <div class="fn-item" style="border-bottom:none; padding:2px 0 0;">
            <div style="color:${parseMeta.color}; font-weight:bold; margin-bottom:6px;">${parseMeta.label} PARSE</div>
            <div style="color:#ccc; font-size:12px; line-height:1.5;">${escapeHtml(parseReason)}</div>
            ${previewHtml}
        </div>
    `;
}
