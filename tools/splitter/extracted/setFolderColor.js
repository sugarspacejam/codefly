function setFolderColor(folder, hexColor) {
    saveFolderPref(folder, 'color', hexColor);
    const colorInt = parseInt(hexColor.replace('#', ''), 16);
    for (const [id, mesh] of nodeMeshes) {
        if (!mesh.userData.nodeData) continue;
        if (mesh.userData.nodeData.folder !== folder) continue;
        mesh.material.color.setHex(colorInt);
        mesh.material.emissive.setHex(colorInt);
        mesh.userData.baseColor = colorInt;
        for (const child of mesh.children) {
            if (child.isMesh && child.material && child.material.transparent) {
                child.material.color.setHex(colorInt);
            }
        }
    }
}
