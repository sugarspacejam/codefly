async function loadGitLabUser() {
    const proxyHost = window.CODEFLY_MULTIPLAYER_HOST || '';
    const baseUrl = proxyHost ? proxyHost : '';
    
    try {
        const response = await fetch(`${baseUrl}/gitlab/oauth/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: authState.token }),
        });
        
        if (!response.ok) throw new Error('Failed to load user');
        const user = await response.json();
        
        // Update UI with user info
        document.getElementById('userAvatar').src = user.avatar_url;
        document.getElementById('userName').textContent = user.name || user.username;
        document.getElementById('userLogin').textContent = '@' + user.username;
        
        // Set provider badge
        const badge = document.getElementById('providerBadge');
        badge.textContent = '🦊 GitLab';
        badge.style.background = '#fc6d26';
        badge.style.color = '#fff';
    } catch (err) {
        console.error('Failed to load user:', err);
    }
}
