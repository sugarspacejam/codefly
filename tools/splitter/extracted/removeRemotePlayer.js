function removeRemotePlayer(playerId) {
    const rp = remotePlayers.get(playerId);
    if (!rp) return;
    addChatMessage(`${rp.nickname} left`, '#f88');
    scene.remove(rp.group);
    remotePlayers.delete(playerId);
}
