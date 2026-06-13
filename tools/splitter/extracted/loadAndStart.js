window.loadAndStart = async function() {
    const repoInput = document.getElementById('repoInput');
    const url = repoInput.value.trim();
    if (!url) {
        showLoadError('Enter a repo URL (GitHub or GitLab)');
        return;
    }

    const provider = url.includes('github.com/') ? 'github'
        : (url.includes('gitlab.com/') ? 'gitlab' : null);
    if (!provider) {
        showLoadError('Only GitHub and GitLab URLs are supported');
        return;
    }

    const nicknameInput = document.getElementById('nicknameInput');
    if (nicknameInput && nicknameInput.value.trim()) {
        myNickname = nicknameInput.value.trim();
    }

    const btn = document.getElementById('startBtn');
    btn.disabled = true;
    btn.textContent = 'LOADING...';
    showLoading(true);
    hideLoadError();

    try {
        let data = null;
        if (provider === 'github') {
            const token = getGitHubTokenForApi();
            data = await generateGraphFromGitHub(url, token, (msg) => {
                btn.textContent = msg;
            });
        }
        if (provider === 'gitlab') {
            const token = getGitLabTokenForApi();
            if (!token) {
                throw new Error('GitLab private repos require login (Login with GitLab)');
            }
            data = await generateGraphFromGitLab(url, token, (msg) => {
                btn.textContent = msg;
            });
        }

        if (!data) {
            throw new Error('Graph generation returned no data');
        }

        if (!data.nodes || !data.edges) {
            throw new Error('Invalid graph data returned');
        }

        graphData = data;
        init();

        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('crosshair').style.display = 'block';
        document.getElementById('hud').style.display = 'block';
        document.getElementById('legend').style.display = 'block';
        document.getElementById('minimap').style.display = 'block';
        document.getElementById('chatBox').style.display = 'block';

        gameStarted = true;
        renderer.domElement.requestPointerLock();
        connectMultiplayer();
        buildSearchIndex();
        if (graphData.meta) showLimitations(graphData.meta);
    } catch (err) {
        showLoadError(err.message);
        btn.disabled = false;
        btn.textContent = 'EXPLORE';
        showLoading(false);
    }
}
