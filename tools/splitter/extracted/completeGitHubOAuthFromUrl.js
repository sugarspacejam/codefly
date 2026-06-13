async function completeGitHubOAuthFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (!error && !code && !state) {
        return;
    }

    const pending = getPendingOAuth();
    if (!pending || pending.provider !== 'github') {
        return;
    }

    if (error) {
        clearPendingOAuth();
        clearLegacyOAuthState();
        alert('GitHub authorization failed: ' + error);
        cleanOAuthUrl();
        return;
    }

    if (!code || !state) {
        return;
    }

    if (state !== pending.state) {
        clearPendingOAuth();
        clearLegacyOAuthState();
        alert('GitHub OAuth session expired. Please connect again.');
        cleanOAuthUrl();
        return;
    }

    clearPendingOAuth();
    clearLegacyOAuthState();
    
    const proxyHost = window.CODEFLY_MULTIPLAYER_HOST || '';
    const baseUrl = proxyHost ? proxyHost : '';
    
    try {
        // Exchange code for token
        const tokenRes = await fetch(`${baseUrl}/github/oauth/authorize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code, state }),
        });
        
        const tokenData = await readJsonFetchResponse(tokenRes, 'GitHub token exchange');
        if (tokenData.error) {
            throw new Error(getOAuthResponseError(tokenData, 'GitHub token exchange', tokenRes.status));
        }
        
        if (!tokenData.access_token) {
            throw new Error('No access token received');
        }
        
        // Get user info
        const userRes = await fetch(`${baseUrl}/github/oauth/user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ access_token: tokenData.access_token }),
        });
        
        const userData = await readJsonFetchResponse(userRes, 'GitHub user fetch');
        
        // Save auth state
        authState = { 
            provider: 'github', 
            token: tokenData.access_token, 
            userLabel: userData.login 
        };
        saveAuthState();
        
        // Clean URL
        cleanOAuthUrl();
        
        // Update UI
        updateAuthUi();
        // Load user's repositories
        if (authState.provider === 'github') {
            loadGitHubUser();
            loadGitHubRepos();
        }
        
    } catch (err) {
        clearPendingOAuth();
        alert('GitHub login failed: ' + err.message);
        cleanOAuthUrl();
    }
}
