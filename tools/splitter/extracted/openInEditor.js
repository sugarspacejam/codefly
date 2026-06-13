function openInEditor(editor, node, line) {
    if (!node.fullPath) {
        throw new Error('Node has no fullPath for IDE open');
    }
    const lineNumber = line || 1;
    const url = editor.scheme
        .replace('{path}', encodeURIComponent(node.fullPath))
        .replace('{line}', lineNumber);
    window.open(url, '_blank');
    closeIdePicker();
}
