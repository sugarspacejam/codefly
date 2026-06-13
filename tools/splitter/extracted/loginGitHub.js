window.loginGitHub = async function() {
    const cfg = getOAuthConfig();
    const clientId = cfg.githubClientId;

    if (!clientId) {
        openPatModal('github');
        return;
    }

    // Use regular OAuth redirect flow
    const state = Math.random().toString(36).substring(7);
    const redirectUri = window.location.origin + window.location.pathname;
    
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'repo');
    url.searchParams.set('state', state);
    
    clearPendingOAuth();
    clearLegacyOAuthState();
    setPendingOAuth('github', state);
    
    // Redirect to GitHub
    window.location.href = url.toString();
}
