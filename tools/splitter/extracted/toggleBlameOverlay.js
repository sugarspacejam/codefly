window.toggleBlameOverlay = async function() {
    if (isBlameLoading) {
        return;
    }
    if (blameEnabled) {
        blameEnabled = false;
        clearFilters();
        return;
    }
    if (!graphData || !graphData.meta || !graphData.meta.repo) {
        throw new Error('Repo metadata missing for blame overlay');
    }
    if (!graphData.meta.provider) {
        throw new Error('Repo provider metadata missing for blame overlay');
    }
    if (graphData.meta.provider !== 'github') {
        throw new Error('Blame overlay is currently supported only for GitHub repos');
    }
    if (Object.keys(blameByNodeId).length === 0) {
        isBlameLoading = true;
        const token = getGitHubTokenForApi();
        const files = graphData.nodes.map((node) => ({ path: node.fullPath }));
        blameByNodeId = await fetchBlameForRepo(graphData.meta.repo, token, files, (msg) => {
            const stats = document.getElementById('graphStats');
            if (stats) stats.textContent = msg;
        });
        isBlameLoading = false;
    }
    applyBlameOverlay();
    blameEnabled = true;
    setActiveFilterButton('Blame overlay (last author)');
}
