async function fetchGitHubViewerLogin(token) {
    const headers = { 'Accept': 'application/vnd.github.v3+json', 'Authorization': `token ${token}` };
    const res = await fetch('https://api.github.com/user', { headers });
    if (!res.ok) {
        throw new Error(`GitHub user fetch failed: ${res.status}`);
    }
    const data = await res.json();
    if (!data || !data.login) {
        throw new Error('GitHub user response missing login');
    }
    return data.login;
}
