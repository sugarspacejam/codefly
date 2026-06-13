window.loginGitLab = async function() {
    const cfg = getOAuthConfig();

    if (!cfg.gitlabClientId) {
        openPatModal('gitlab');
        return;
    }

    // Use regular OAuth redirect flow
    const state = Math.random().toString(36).substring(7);
    const redirectUri = window.location.origin + window.location.pathname;
    
    const url = new URL('https://gitlab.com/oauth/authorize');
    url.searchParams.set('client_id', cfg.gitlabClientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'read_api');
    url.searchParams.set('state', state);
    
    clearPendingOAuth();
    clearLegacyOAuthState();
    setPendingOAuth('gitlab', state);
    
    // Redirect to GitLab
    window.location.href = url.toString();
}
