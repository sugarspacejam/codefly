window.exportTourLink = function() {
    const link = buildTourLink();
    navigator.clipboard.writeText(link).then(() => {
        const btn = document.querySelector('[onclick="exportTourLink()"]');
        if (!btn) {
            throw new Error('Tour export button missing');
        }
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 1800);
    });
}
