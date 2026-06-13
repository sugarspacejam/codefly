async function loadGitHubRepos(page = 1) {
    const proxyHost = window.CODEFLY_MULTIPLAYER_HOST || '';
    const baseUrl = proxyHost ? proxyHost : '';
    
    try {
        const response = await fetch(`https://api.github.com/user/repos?per_page=${reposPerPage}&page=${page}&sort=updated&type=all`, {
            headers: {
                'Authorization': `Bearer ${authState.token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });
        
        if (!response.ok) throw new Error('Failed to load repositories');
        const repos = await response.json();
        
        if (page === 1) {
            allRepos = repos;
            document.getElementById('repoList').innerHTML = '';
        } else {
            allRepos = [...allRepos, ...repos];
        }
        
        filteredRepos = allRepos;
        displayRepos();
        
        // Show/hide load more button
        const loadMoreBtn = document.getElementById('loadMoreRepos');
        loadMoreBtn.style.display = repos.length === reposPerPage ? 'block' : 'none';
        
        currentPage = page;
    } catch (err) {
        console.error('Failed to load repositories:', err);
        document.getElementById('repoList').innerHTML = '<div style="padding:20px; text-align:center; color:#f44;">Failed to load repositories</div>';
    }
}
