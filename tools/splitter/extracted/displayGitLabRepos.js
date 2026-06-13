function displayGitLabRepos() {
    const repoList = document.getElementById('repoList');
    const searchTerm = document.getElementById('repoSearch').value.toLowerCase();
    
    // Filter repos
    filteredRepos = allRepos.filter(repo => 
        repo.name.toLowerCase().includes(searchTerm) ||
        repo.description?.toLowerCase().includes(searchTerm) ||
        repo.owner?.username?.toLowerCase().includes(searchTerm) ||
        repo.namespace?.full_path?.toLowerCase().includes(searchTerm)
    );
    
    if (filteredRepos.length === 0) {
        repoList.innerHTML = '<div style="padding:20px; text-align:center; color:#555;">No repositories found</div>';
        return;
    }
    
    repoList.innerHTML = filteredRepos.map(repo => `
        <div class="repo-item" onclick="selectRepo('${repo.path_with_namespace}', 'gitlab')" style="padding:12px; border-bottom:1px solid #222; cursor:pointer; transition:background 0.2s;">
            <div style="display:flex; align-items:start; gap:12px;">
                <img src="${repo.avatar_url || repo.owner?.avatar_url}" style="width:32px; height:32px; border-radius:4px;">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:bold; color:#fff; margin-bottom:4px;">
                        ${repo.path_with_namespace}
                        ${repo.visibility === 'private' ? '<span style="background:#f44; color:#fff; padding:2px 6px; border-radius:3px; font-size:10px; margin-left:8px;">Private</span>' : ''}
                        ${repo.forked_from_project ? '<span style="background:#666; color:#fff; padding:2px 6px; border-radius:3px; font-size:10px; margin-left:4px;">Fork</span>' : ''}
                    </div>
                    ${repo.description ? `<div style="color:#888; font-size:12px; margin-bottom:4px; line-height:1.4;">${repo.description}</div>` : ''}
                    <div style="color:#666; font-size:11px;">
                        ⭐ ${repo.star_count} · 🍴 ${repo.forks_count} · ${repo.topics?.[0] || 'Unknown'}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add hover effect
    repoList.querySelectorAll('.repo-item').forEach(item => {
        item.addEventListener('mouseenter', () => item.style.background = '#1a1a1a');
        item.addEventListener('mouseleave', () => item.style.background = 'transparent');
    });
}
