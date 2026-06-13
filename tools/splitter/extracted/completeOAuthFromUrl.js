async function completeOAuthFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    if (!code && !state && !error) return;

    const pending = getPendingOAuth();
    if (!pending) {
        cleanOAuthUrl();
        return;
    }
    if (pending.provider === 'github') {
        await completeGitHubOAuthFromUrl();
        return;
    }
    if (pending.provider === 'gitlab') {
        await completeGitLabOAuthFromUrl();
        return;
    }
    clearPendingOAuth();
}
