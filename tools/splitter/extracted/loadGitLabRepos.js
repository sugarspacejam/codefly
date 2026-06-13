async function loadGitLabRepos(page = 1) {
    try {
        const response = await fetch(`https://gitlab.com/api/v4/projects?per_page=${reposPerPage}&page=${page}&order_by=updated&sort=desc&membership=true`, {
            headers: {
                'Authorization': `Bearer ${authState.token}`,
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
        displayGitLabRepos();
        
        // Show/hide load more button
        const loadMoreBtn = document.getElementById('loadMoreRepos');
        loadMoreBtn.style.display = repos.length === reposPerPage ? 'block' : 'none';
        
        currentPage = page;
    } catch (err) {
        console.error('Failed to load repositories:', err);
        document.getElementById('repoList').innerHTML = '<div style="padding:20px; text-align:center; color:#f44;">Failed to load repositories</div>';
    }
}
