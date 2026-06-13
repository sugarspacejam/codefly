function updateMovement() {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerGroup.quaternion).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerGroup.quaternion);
    right.y = 0;
    right.normalize();

    currentBoost = keys['shift'] ? boostMultiplier : 1;
    const speed = baseSpeed * currentBoost;

    if (isFlying) {
        if (keys['w']) playerGroup.position.add(forward.clone().multiplyScalar(speed));
        if (keys['s']) playerGroup.position.add(forward.clone().multiplyScalar(-speed));
        if (keys['a']) playerGroup.position.add(right.clone().multiplyScalar(-speed));
        if (keys['d']) playerGroup.position.add(right.clone().multiplyScalar(speed));
        if (keys[' ']) playerGroup.position.y += speed;
        if (keys['control']) playerGroup.position.y -= speed;
    } else {
        const forwardFlat = forward.clone();
        forwardFlat.y = 0;
        forwardFlat.normalize();

        if (keys['w']) playerGroup.position.add(forwardFlat.clone().multiplyScalar(speed * 0.5));
        if (keys['s']) playerGroup.position.add(forwardFlat.clone().multiplyScalar(-speed * 0.5));
        if (keys['a']) playerGroup.position.add(right.clone().multiplyScalar(-speed * 0.5));
        if (keys['d']) playerGroup.position.add(right.clone().multiplyScalar(speed * 0.5));

        if (keys[' '] && playerGroup.position.y <= groundLevel + 1) {
            verticalVelocity = 0.4;
        }

        verticalVelocity += gravity;
        playerGroup.position.y += verticalVelocity;

        if (playerGroup.position.y < groundLevel + 1) {
            playerGroup.position.y = groundLevel + 1;
            verticalVelocity = 0;
        }
    }

    const p = playerGroup.position;
    document.getElementById('hudPos').textContent =
        `${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
    document.getElementById('hudSpeed').textContent = currentBoost > 1 ? `${currentBoost}x BOOST` : '1x';
}
