function getGitHubTokenForApi() {
    if (authState.provider === 'github' && authState.token) {
        return authState.token;
    }
    const tokenInput = document.getElementById('ghTokenInput');
    const token = tokenInput ? tokenInput.value.trim() : '';
    return token;
}
