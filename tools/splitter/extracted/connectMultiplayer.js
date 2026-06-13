function connectMultiplayer() {
    if (!graphData || !graphData.meta || !graphData.meta.repo) {
        document.getElementById('onlineCount').textContent = '1';
        return;
    }

    if (graphData.meta.provider === 'local') {
        document.getElementById('onlineCount').textContent = '1';
        return;
    }

    const roomId = graphData.meta.repo;
    const wsUrl = buildMultiplayerWsUrl(roomId);

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        wsReconnectDelay = 1000;
        document.getElementById('onlineCount').textContent = '1';
        sendPositionUpdate();
    };

    ws.onmessage = (event) => {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            return;
        }

        if (msg.type === 'presence_snapshot') {
            // Full snapshot of all other users in the room
            const incomingIds = new Set(msg.users.map((u) => u.id));

            // Remove players who left
            for (const [id] of remotePlayers) {
                if (!incomingIds.has(id)) {
                    removeRemotePlayer(id);
                }
            }

            // Add or update players
            for (const user of msg.users) {
                if (user.id === myPlayerId) continue;
                if (!remotePlayers.has(user.id)) {
                    createRemotePlayer({
                        id: user.id,
                        nickname: user.nickname,
                        color: user.color,
                        position: { x: user.x, y: user.y, z: user.z },
                    });
                    addChatMessage(`${user.nickname} is here`, '#0f8');
                } else {
                    updateRemotePlayer(
                        user.id,
                        { x: user.x, y: user.y, z: user.z },
                        { yaw: user.yaw },
                        user.nickname
                    );
                }
            }
            updateOnlineCount();
        }

        if (msg.type === 'chat') {
            addChatMessage(`${msg.nickname}: ${msg.text}`, '#8ff');
        }

        if (msg.type === 'leave') {
            removeRemotePlayer(msg.id);
            updateOnlineCount();
        }
    };

    ws.onclose = () => {
        document.getElementById('onlineCount').textContent = '0';
        const delay = Math.min(wsReconnectDelay, 30000);
        setTimeout(connectMultiplayer, delay);
        wsReconnectDelay = Math.min(wsReconnectDelay * 2, 30000);
    };

    ws.onerror = () => {};
}
