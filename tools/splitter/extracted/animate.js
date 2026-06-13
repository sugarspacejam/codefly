function animate() {
    requestAnimationFrame(animate);
    frameCount++;

    if (gameStarted && pageVisible) {
        updateMovement();
        updateFlyTarget();
        updateHover();
        if (frameCount % 2 === 0) updateMinimap();
        updateFunctionOrbits();

        // Node bobbing using baseY (no drift)
        const time = Date.now() * 0.001;
        let hasLayoutTransition = false;
        for (const [id, mesh] of nodeMeshes) {
            if (mesh.userData.targetPos) {
                hasLayoutTransition = true;
                mesh.position.lerp(mesh.userData.targetPos, 0.08);
                if (mesh.position.distanceTo(mesh.userData.targetPos) < 0.05) {
                    mesh.position.copy(mesh.userData.targetPos);
                    delete mesh.userData.targetPos;
                }
            } else {
                mesh.position.y = mesh.userData.baseY + Math.sin(time + mesh.position.x * 0.1) * 0.3;
            }
        }
        if (hasLayoutTransition) {
            rebuildEdges();
        }

        // Send position every 3 frames
        if (frameCount % 3 === 0) {
            sendPositionUpdate();
        }
    }

    renderer.render(scene, camera);
}
