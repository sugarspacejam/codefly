function updateRemotePlayer(playerId, position, rotation, nickname) {
    const rp = remotePlayers.get(playerId);
    if (!rp) return;

    // Smooth interpolation
    rp.group.position.lerp(_tmpVec3.set(position.x, position.y, position.z), 0.15);

    if (rotation) {
        const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation.yaw);
        rp.group.quaternion.slerp(yawQ, 0.15);
    }

    if (nickname && nickname !== rp.nickname) {
        rp.nickname = nickname;
        updateRemotePlayerLabel(playerId);
    }
}
