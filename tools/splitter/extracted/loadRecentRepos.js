function loadRecentRepos() {
    localStorage.removeItem(RECENT_REPOS_STORAGE_KEY);
    const container = document.getElementById('recentRepos');
    if (!container) {
        throw new Error('Recent repos container missing from DOM');
    }
    container.innerHTML = '';
}
