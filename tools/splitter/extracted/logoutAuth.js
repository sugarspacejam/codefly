window.logoutAuth = function() {
    authState = { provider: null, token: null, userLabel: null };
    saveAuthState();

    clearPendingOAuth();
    clearLegacyOAuthState();

    // Clear repository data
    allRepos = [];
    filteredRepos = [];
    currentPage = 1;

    // Reset UI
    const repoList = document.getElementById('repoList');
    if (repoList) {
        repoList.innerHTML = '<div style="padding:40px; text-align:center; color:#8b949e;">Connect an account to load repositories.</div>';
    }
}
