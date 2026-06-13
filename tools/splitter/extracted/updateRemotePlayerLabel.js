function updateRemotePlayerLabel(playerId) {
    const rp = remotePlayers.get(playerId);
    if (!rp) return;
    rp.group.remove(rp.label);
    rp.label.material.dispose();
    rp.label.material.map.dispose();
    const newLabel = createTextSprite(rp.nickname, hslToHex(rp.color), 24);
    newLabel.position.set(0, 2.5, 0);
    newLabel.scale.set(4, 2, 1);
    rp.group.add(newLabel);
    rp.label = newLabel;
}
