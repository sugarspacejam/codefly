function getPendingOAuth() {
    const raw = sessionStorage.getItem(OAUTH_PENDING_KEY) || localStorage.getItem(OAUTH_PENDING_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.provider || !parsed.state) {
            return null;
        }
        const createdAt = Number(parsed.createdAt || 0);
        if (!Number.isFinite(createdAt) || createdAt <= 0 || (Date.now() - createdAt) > 10 * 60 * 1000) {
            clearPendingOAuth();
            return null;
        }
        return parsed;
    } catch {
        clearPendingOAuth();
        return null;
    }
}
