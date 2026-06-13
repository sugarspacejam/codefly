window.toggleChurnHeat = async function() {
    if (isChurnLoading) {
        return;
    }
    if (!churnHeatEnabled) {
        if (!graphData || !graphData.meta || !graphData.meta.repo) {
            throw new Error('Repo metadata missing for churn heatmap');
        }
        if (!graphData.meta.provider) {
            throw new Error('Repo provider metadata missing for churn heatmap');
        }
        if (graphData.meta.provider !== 'github') {
            throw new Error('Churn heatmap is currently supported only for GitHub repos');
        }
        if (Object.keys(churnByNodeId).length === 0) {
            isChurnLoading = true;
            const token = getGitHubTokenForApi();
            const files = graphData.nodes.map((node) => ({ path: node.fullPath }));
            churnByNodeId = await fetchCommitDatesForRepo(graphData.meta.repo, token, files, (msg) => {
                const stats = document.getElementById('graphStats');
                if (stats) stats.textContent = msg;
            });
            isChurnLoading = false;
        }
        applyChurnHeatmap();
        churnHeatEnabled = true;
        setActiveFilterButton('Churn heatmap (latest commits)');
        return;
    }
    churnHeatEnabled = false;
    clearFilters();
}
