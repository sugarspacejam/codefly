function expandFunctions(nodeId) {
    const mesh = nodeMeshes.get(nodeId);
    if (!mesh) return;
    const node = mesh.userData.nodeData;
    if (!node.definitions || node.definitions.length === 0) return;

    expandedNodes.add(nodeId);
    const fnMeshes = [];
    const count = node.definitions.length;
    const orbitRadius = mesh.userData.baseSize + 3 + count * 0.15;
    const SPACING = 2.2;

    for (let i = 0; i < count; i++) {
        const def = node.definitions[i];
        const angle = (i / count) * Math.PI * 2;

        const kindColor = def.kind === 'class' ? 0x00ccff : def.kind === 'variable' ? 0xcc66ff : 0xff8800;
        const kindEmissive = def.kind === 'class' ? 0x0099cc : def.kind === 'variable' ? 0x9933cc : 0xff6600;
        const fnGeo = new THREE.OctahedronGeometry(0.4, 0);
        const fnMat = new THREE.MeshPhongMaterial({
            color: kindColor,
            emissive: kindEmissive,
            emissiveIntensity: 0.4,
            shininess: 50,
        });
        const fnMesh = new THREE.Mesh(fnGeo, fnMat);

        if (fileLayoutMode) {
            fnMesh.position.set(
                mesh.position.x + 4,
                mesh.position.y + (count / 2 - i) * SPACING,
                mesh.position.z
            );
        } else {
            fnMesh.position.set(
                mesh.position.x + Math.cos(angle) * orbitRadius,
                mesh.position.y,
                mesh.position.z + Math.sin(angle) * orbitRadius
            );
        }
        fnMesh.userData = {
            isFunctionNode: true,
            functionName: def.name,
            functionLine: def.line,
            functionKind: def.kind,
            parentNodeId: nodeId,
            orbitAngle: angle,
            orbitRadius: orbitRadius,
            orbitIndex: i,
            orbitCount: count,
            fileLayoutIndex: i,
            fileLayoutCount: count,
        };

        // Function label
        const label = createTextSprite(def.name, kindColor, 28);
        label.position.set(0, 1.2, 0);
        label.scale.set(3, 1.5, 1);
        fnMesh.add(label);

        // Connection line to parent
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            mesh.position.clone(),
            fnMesh.position.clone(),
        ]);
        const lineMat = new THREE.LineBasicMaterial({
            color: kindColor,
            transparent: true,
            opacity: 0.3,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        line.userData = { fnConnectionLine: true, parentNodeId: nodeId };
        scene.add(line);

        scene.add(fnMesh);
        fnMeshes.push({ mesh: fnMesh, line: line });
    }

    functionMeshes.set(nodeId, fnMeshes);
    updateFunctionRaycastTargets(nodeId);

    // Show function panel
    updateFunctionPanel(node);
}
