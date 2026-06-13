function computeCommitAgeDays(dateStr) {
    const parsed = Date.parse(dateStr);
    if (!Number.isFinite(parsed)) {
        throw new Error('Invalid commit date received for churn heatmap');
    }
    const now = Date.now();
    const diffMs = now - parsed;
    return diffMs / (1000 * 60 * 60 * 24);
}
