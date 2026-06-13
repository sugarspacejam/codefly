function getPendingOAuth() {
    const payload = sessionStorage.getItem(OAUTH_PENDING_KEY);
    if (!payload) {
        return null;
    }
    const data = JSON.parse(payload);
    if (Date.now() - data.createdAt > 300000) {
        return null;
    }
    return data;
}
