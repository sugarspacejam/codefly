function loadConnectedProviderData() {
    if (authState.provider === 'github' && authState.token) {
        loadGitHubUser();
        loadGitHubRepos();
    } else if (authState.provider === 'gitlab' && authState.token) {
        loadGitLabUser();
        loadGitLabRepos();
    }
}
