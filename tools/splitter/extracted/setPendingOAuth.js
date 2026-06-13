function setPendingOAuth(provider, state) {
    const payload = JSON.stringify({ provider, state, createdAt: Date.now() });
    sessionStorage.setItem(OAUTH_PENDING_KEY, payload);
    localStorage.setItem(OAUTH_PENDING_KEY, payload);
}
