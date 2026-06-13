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
