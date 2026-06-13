function setFolderShape(folder, shape) {
    const VALID_SHAPES = ['sphere', 'cube', 'diamond', 'cylinder'];
    if (!VALID_SHAPES.includes(shape)) {
        throw new Error(`setFolderShape: invalid shape "${shape}"`);
    }
    saveFolderPref(folder, 'shape', shape);

    for (const [id, mesh] of nodeMeshes) {
        if (!mesh.userData.nodeData) continue;
        if (mesh.userData.nodeData.folder !== folder) continue;
        const size = mesh.userData.baseSize;
        let newGeo;
        if (shape === 'sphere') newGeo = new THREE.SphereGeometry(size, 16, 16);
        if (shape === 'cube') newGeo = new THREE.BoxGeometry(size * 1.5, size * 1.5, size * 1.5);
        if (shape === 'diamond') newGeo = new THREE.OctahedronGeometry(size * 1.2, 0);
        if (shape === 'cylinder') newGeo = new THREE.CylinderGeometry(size * 0.8, size * 0.8, size * 2, 12);
        mesh.geometry.dispose();
        mesh.geometry = newGeo;
    }
}
