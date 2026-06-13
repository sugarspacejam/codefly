window.savePatToken = async function() {
    const modal = document.getElementById('patModal');
    const input = document.getElementById('patModalInput');
    const errEl = document.getElementById('patModalError');
    if (!modal || !input || !errEl) {
        throw new Error('PAT modal elements missing');
    }
    const provider = modal.dataset.provider;
    const token = input.value.trim();
    if (!token) {
        errEl.textContent = 'Please enter a token';
        return;
    }
    errEl.textContent = 'Verifying…';
    try {
        let userLabel = provider;
        if (provider === 'github') {
            userLabel = await fetchGitHubViewerLogin(token);
        } else {
            const res = await fetch('https://gitlab.com/api/v4/user', {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
            });
            if (!res.ok) {
                throw new Error(`GitLab token verification failed: ${res.status}`);
            }
            const data = await res.json();
            if (!data || !data.username) {
                throw new Error('GitLab user response missing username');
            }
            userLabel = data.username;
        }
        clearPendingOAuth();
        clearLegacyOAuthState();
        authState = { provider, token, userLabel };
        saveAuthState();
        window.closePatModal();
    } catch (err) {
        errEl.textContent = err.message || 'Token verification failed';
    }
}
