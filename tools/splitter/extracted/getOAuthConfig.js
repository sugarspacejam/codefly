function getOAuthConfig() {
    const cfg = window.CODECHAT_OAUTH;
    if (!cfg) {
        return { githubClientId: '', gitlabClientId: '', gitlabRedirectUri: window.location.origin + window.location.pathname };
    }
    return cfg;
}
