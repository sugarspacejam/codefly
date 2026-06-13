function getGitLabTokenForApi() {
    if (authState.provider === 'gitlab' && authState.token) {
        return authState.token;
    }
    return '';
}
