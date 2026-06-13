window.clearFilters = function() {
    for (const [id, mesh] of nodeMeshes) {
        mesh.material.opacity = 1;
        mesh.material.emissiveIntensity = 0.3;
        mesh.material.transparent = false;
        mesh.scale.setScalar(1);
        mesh.material.color.setHex(mesh.userData.baseColor);
    }
    for (const line of edgeLines) {
        line.material.opacity = 0.25;
        line.material.color.setHex(0x1a3a5a);
    }
    document.getElementById('analyticsResults').innerHTML = '';
    document.querySelectorAll('.ap-btn').forEach(b => b.classList.remove('active'));
    churnHeatEnabled = false;
}
