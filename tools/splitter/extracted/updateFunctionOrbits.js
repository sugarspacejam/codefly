function updateFunctionOrbits() {
    if (orbitPaused || orbitSpeed === 0) {
        return;
    }

    const time = Date.now() * 0.00008 * orbitSpeed;
    for (const [nodeId, fnMeshes] of functionMeshes) {
        const parentMesh = nodeMeshes.get(nodeId);
        if (!parentMesh) continue;

        for (const { mesh: fnMesh, line } of fnMeshes) {
            const ud = fnMesh.userData;

            if (!fileLayoutMode) {
                const angle = ud.orbitAngle + time;
                fnMesh.position.set(
                    parentMesh.position.x + Math.cos(angle) * ud.orbitRadius,
                    parentMesh.position.y + Math.sin(time * 0.4 + ud.orbitIndex) * 0.3,
                    parentMesh.position.z + Math.sin(angle) * ud.orbitRadius
                );
                fnMesh.rotation.y += 0.001 * orbitSpeed;
                fnMesh.rotation.x += 0.0004 * orbitSpeed;
            }

            // Update connection line
            const positions = line.geometry.attributes.position.array;
            positions[0] = parentMesh.position.x;
            positions[1] = parentMesh.position.y;
            positions[2] = parentMesh.position.z;
            positions[3] = fnMesh.position.x;
            positions[4] = fnMesh.position.y;
            positions[5] = fnMesh.position.z;
            line.geometry.attributes.position.needsUpdate = true;
        }
    }
}
