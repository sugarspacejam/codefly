async function loadGitHubUser() {
    const proxyHost = window.CODEFLY_MULTIPLAYER_HOST || '';
    const baseUrl = proxyHost ? proxyHost : '';
    
    try {
        const response = await fetch(`${baseUrl}/github/oauth/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: authState.token }),
        });
        
        if (!response.ok) throw new Error('Failed to load user');
        const user = await response.json();
        
        // Update UI with user info
        document.getElementById('userAvatar').src = user.avatar_url;
        document.getElementById('userName').textContent = user.name || user.login;
        document.getElementById('userLogin').textContent = '@' + user.login;
        
        // Set provider badge
        const badge = document.getElementById('providerBadge');
        badge.textContent = '🐙 GitHub';
        badge.style.background = '#238636';
        badge.style.color = '#fff';
    } catch (err) {
        console.error('Failed to load user:', err);
    }
}
