function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


function getPendingOAuth() {
    const payload = sessionStorage.getItem(OAUTH_PENDING_KEY);
    if (!payload) {
        return null;
    }
    const data = JSON.parse(payload);
    if (Date.now() - data.createdAt > 300000) {
        return null;
    }
    return data;
}


function clearPendingOAuth() {
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
    localStorage.removeItem(OAUTH_PENDING_KEY);
}


function loadRecentRepos() {
    localStorage.removeItem(RECENT_REPOS_STORAGE_KEY);
    const container = document.getElementById('recentRepos');
    if (!container) {
        throw new Error('Recent repos container missing from DOM');
    }
    container.innerHTML = '';
}


function showLoadError(msg) {
    const el = document.getElementById('loadError');
    el.textContent = msg;
    el.style.display = 'block';
}


function hideLoadError() {
    document.getElementById('loadError').style.display = 'none';
}


function updateAuthUi() {
    const status = document.getElementById('authStatus');
    const logoutBtn = document.getElementById('logoutBtn');
    if (authState.provider) {
        if (status) status.textContent = `Logged in as ${authState.userLabel}`;
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } else {
        if (status) status.textContent = 'Not connected';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

