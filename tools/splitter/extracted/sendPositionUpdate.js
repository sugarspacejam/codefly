function sendPositionUpdate() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
        type: 'presence',
        x: playerGroup.position.x,
        y: playerGroup.position.y,
        z: playerGroup.position.z,
        yaw: playerYaw,
        nickname: myNickname,
        color: myColor,
        nodeId: hoveredNodeId || null,
    }));
}
