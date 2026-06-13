function showLimitations(meta) {
    const unsupported = Array.isArray(meta.unsupportedExtensions) ? meta.unsupportedExtensions : [];
    const parseSummary = meta.parseSummary || {};
    const totalFiles = Number(meta.totalFiles || 0);
    const partialCount = Number(parseSummary.partial || 0);
    const unsupportedCount = Number(parseSummary.unsupported || 0);
    const totalLimited = partialCount + unsupportedCount;
    if (unsupported.length === 0 && totalLimited === 0) return;

    const banner = document.getElementById('limitationsBanner');
    const extsEl = document.getElementById('lbExts');
    const titleEl = banner.querySelector('.lb-title');
    if (titleEl) {
        titleEl.textContent = totalFiles > 0
            ? `Parser Coverage: ${Math.max(0, totalFiles - unsupportedCount)}/${totalFiles}`
            : 'Parser Coverage';
    }
    const extText = unsupported.length > 0 ? `Unsupported extensions: ${unsupported.join(', ')}` : 'No unknown extensions detected';
    extsEl.textContent = `${extText} · Partial: ${partialCount} · Unsupported files: ${unsupportedCount}`;
    banner.style.display = 'block';

    const contactBtn = document.getElementById('contactBtn');
    contactBtn.style.display = unsupported.length > 0 ? 'block' : 'none';

    const textarea = document.getElementById('contactMessage');
    const repoUrl = document.getElementById('repoInput').value.trim();
    textarea.value = `Hi! I'd love CodeFly to support these file types:\n\n${unsupported.join(', ')}\n\nParse summary: partial=${partialCount}, unsupported=${unsupportedCount}\nRepo: ${repoUrl}\n\nThanks!`;
}
