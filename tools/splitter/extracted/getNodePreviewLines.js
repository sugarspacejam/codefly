function getNodePreviewLines(node) {
    if (!node) {
        return [];
    }
    if (Array.isArray(node.rawPreview) && node.rawPreview.length > 0) {
        return node.rawPreview;
    }
    if (Array.isArray(node.preview) && node.preview.length > 0) {
        return node.preview.slice(0, 3);
    }
    return [];
}
