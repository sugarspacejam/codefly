function updateMinimap() {
    const canvas = document.getElementById('minimap');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(5,5,16,0.9)';
    ctx.fillRect(0, 0, w, h);

    const scale = 0.3;
    const cx = w / 2;
    const cy = h / 2;
    const px = playerGroup.position.x;
    const pz = playerGroup.position.z;

    ctx.strokeStyle = 'rgba(26,58,90,0.3)';
    ctx.lineWidth = 0.5;
    for (const line of edgeLines) {
        const from = nodeMeshes.get(line.userData.from);
        const to = nodeMeshes.get(line.userData.to);
        if (!from || !to) continue;
        ctx.beginPath();
        ctx.moveTo(cx + (from.position.x - px) * scale, cy + (from.position.z - pz) * scale);
        ctx.lineTo(cx + (to.position.x - px) * scale, cy + (to.position.z - pz) * scale);
        ctx.stroke();
    }

    for (const [id, mesh] of nodeMeshes) {
        const dx = (mesh.position.x - px) * scale;
        const dz = (mesh.position.z - pz) * scale;
        const sx = cx + dx;
        const sy = cy + dz;
        if (sx < -5 || sx > w + 5 || sy < -5 || sy > h + 5) continue;

        _tmpColor.set(mesh.userData.baseColor);
        ctx.fillStyle = `rgb(${Math.floor(_tmpColor.r*255)},${Math.floor(_tmpColor.g*255)},${Math.floor(_tmpColor.b*255)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Remote players on minimap
    for (const [id, rp] of remotePlayers) {
        const rpx = (rp.group.position.x - px) * scale;
        const rpz = (rp.group.position.z - pz) * scale;
        ctx.fillStyle = '#f0f';
        ctx.beginPath();
        ctx.arc(cx + rpx, cy + rpz, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Player dot
    ctx.fillStyle = '#0f8';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#0f8';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(playerGroup.quaternion);
    ctx.strokeStyle = '#0f8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + fwd.x * 15, cy + fwd.z * 15);
    ctx.stroke();
}
