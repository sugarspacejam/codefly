function updateAuthUi() {
    const status = document.getElementById('authStatus');
    const logoutBtn = document.getElementById('logoutBtn');
    const authBlock = document.getElementById('authBlock');
    const repoBrowser = document.getElementById('repoBrowser');
    const repoInputSection = document.getElementById('publicRepoSection');
    const localFolderSection = document.getElementById('localFolderSection');
    const privateRepoSection = document.getElementById('privateAuthSection');
    const startBtn = document.getElementById('startBtn');
    const loadingBar = document.getElementById('loadingBar');
    const graphStats = document.getElementById('graphStats');
    const recentRepos = document.getElementById('recentRepos');
    const controlsHint = document.querySelector('.controls-hint');
    
    if (!status || !logoutBtn || !authBlock || !repoBrowser) return;

    if (authState.provider && authState.token) {
        status.textContent = `Connected as ${authState.userLabel}`;
        status.className = 'logged-in';
        logoutBtn.style.display = 'inline-block';
        
        // Show repository browser for GitHub and GitLab
        if (authState.provider === 'github' || authState.provider === 'gitlab') {
            authBlock.style.display = 'none';
            repoBrowser.style.display = 'block';
            
            // Hide irrelevant sections when authenticated
            if (repoInputSection) repoInputSection.style.display = 'none';
            if (localFolderSection) localFolderSection.style.display = 'none';
            if (privateRepoSection) privateRepoSection.style.display = 'none';
            if (startBtn) startBtn.style.display = 'none';
            if (loadingBar) loadingBar.style.display = 'none';
            if (graphStats) graphStats.style.display = 'none';
            if (recentRepos) recentRepos.style.display = 'none';
            if (controlsHint) controlsHint.style.display = 'none';
        }
    } else {
        status.textContent = 'Not connected';
        status.className = 'logged-out';
        logoutBtn.style.display = 'none';
        authBlock.style.display = 'block';
        repoBrowser.style.display = 'none';
        
        // Show all sections when not authenticated
        if (repoInputSection) repoInputSection.style.display = 'block';
        if (localFolderSection) localFolderSection.style.display = 'block';
        if (privateRepoSection) privateRepoSection.style.display = 'block';
        if (startBtn) startBtn.style.display = 'inline-block';
        if (recentRepos) recentRepos.style.display = 'block';
        if (controlsHint) controlsHint.style.display = 'block';
    }
}
