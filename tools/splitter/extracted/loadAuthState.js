function loadAuthState() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
        authState = { provider: null, token: null, userLabel: null };
        return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid auth state in localStorage');
    }
    authState = {
        provider: parsed.provider || null,
        token: parsed.token || null,
        userLabel: parsed.userLabel || null,
    };
}
