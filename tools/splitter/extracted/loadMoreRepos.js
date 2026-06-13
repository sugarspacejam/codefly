function loadMoreRepos() {
    if (authState.provider === 'github') {
        loadGitHubRepos(currentPage + 1);
    } else if (authState.provider === 'gitlab') {
        loadGitLabRepos(currentPage + 1);
    }
}
