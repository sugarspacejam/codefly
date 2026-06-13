async function completeGitLabOAuthFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (!error && !code && !state) {
        return;
    }

    const pending = getPendingOAuth();
    if (!pending || pending.provider !== 'gitlab') {
        return;
    }

    if (error) {
        clearPendingOAuth();
        clearLegacyOAuthState();
        alert('GitLab authorization failed: ' + error);
        cleanOAuthUrl();
        return;
    }

    if (!code || !state) {
        return;
    }

    if (state !== pending.state) {
        clearPendingOAuth();
        clearLegacyOAuthState();
        alert('GitLab OAuth session expired. Please connect again.');
        cleanOAuthUrl();
        return;
    }

    clearPendingOAuth();
    clearLegacyOAuthState();
    
    const proxyHost = window.CODEFLY_MULTIPLAYER_HOST || '';
    const baseUrl = proxyHost ? proxyHost : '';
    
    try {
        // Exchange code for token
        const tokenRes = await fetch(`${baseUrl}/gitlab/oauth/authorize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code, state }),
        });
        
        const tokenData = await readJsonFetchResponse(tokenRes, 'GitLab token exchange');
        if (tokenData.error) {
            throw new Error(getOAuthResponseError(tokenData, 'GitLab token exchange', tokenRes.status));
        }
        
        if (!tokenData.access_token) {
            throw new Error('No access token received');
        }
        
        // Get user info
        const userRes = await fetch(`${baseUrl}/gitlab/oauth/user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ access_token: tokenData.access_token }),
        });
        
        const userData = await readJsonFetchResponse(userRes, 'GitLab user fetch');
        
        // Save auth state
        authState = { 
            provider: 'gitlab', 
            token: tokenData.access_token, 
            userLabel: userData.username 
        };
        saveAuthState();
        
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
        
        // Update UI
        updateAuthUi();
        // Load user's repositories
        if (authState.provider === 'gitlab') {
            loadGitLabUser();
            loadGitLabRepos();
        }
        
    } catch (err) {
        clearPendingOAuth();
        alert('GitLab login failed: ' + err.message);
        cleanOAuthUrl();
    }
}
