function cleanOAuthUrl() {
    window.history.replaceState({}, '', window.location.pathname);
}
