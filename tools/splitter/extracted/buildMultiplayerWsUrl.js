function buildMultiplayerWsUrl(roomId) {
    if (MULTIPLAYER_HOST) {
        return `${MULTIPLAYER_HOST.replace(/^http/, 'ws')}/room/${encodeURIComponent(roomId)}`;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const wsPort = getWsPortFromMeta();
    return `${protocol}//${host}:${wsPort}/room/${encodeURIComponent(roomId)}`;
}
