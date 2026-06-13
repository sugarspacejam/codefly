function clearPendingOAuth() {
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
    localStorage.removeItem(OAUTH_PENDING_KEY);
}
