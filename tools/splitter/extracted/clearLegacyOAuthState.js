function clearLegacyOAuthState() {
    sessionStorage.removeItem('github_oauth_state');
    localStorage.removeItem('github_oauth_state');
    sessionStorage.removeItem('gitlab_oauth_state');
    localStorage.removeItem('gitlab_oauth_state');
}
