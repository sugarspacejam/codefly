function buildGraph() {
    const { positions, folderPositions } = getLayoutPositions();

    for (const node of graphData.nodes) {
        const pos = positions[node.id];
        if (!pos) continue;

        const savedPrefs = getFolderPrefs(node.folder);
        let color = getFolderColor(node.folder);
        if (savedPrefs.color) {
            color = parseInt(savedPrefs.color.replace('#', ''), 16);
        }
        const parseStatus = getNodeParseStatus(node);
        if (parseStatus === UI_PARSE_STATUS_UNSUPPORTED) {
            color = 0x6c6c6c;
        }
        const size = Math.max(0.5, Math.min(2.5, Math.sqrt(node.lines) * 0.1));
        const hasDefs = node.definitions && node.definitions.length > 0;
        const opacity = parseStatus === UI_PARSE_STATUS_UNSUPPORTED ? 0.58 : parseStatus === UI_PARSE_STATUS_PARTIAL ? 0.85 : 1;

        const geo = new THREE.SphereGeometry(size, 16, 16);
        const mat = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
            shininess: 30,
            transparent: opacity < 1,
            opacity,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.userData = {
            nodeData: node,
            baseColor: color,
            baseSize: size,
            baseY: pos.y,
            isFileNode: true,
        };
        scene.add(mesh);
        nodeMeshes.set(node.id, mesh);

        mat.color.setHex(color);
        mat.emissive.setHex(color);
        mesh.userData.baseColor = color;

        // Glow
        const glowGeo = new THREE.SphereGeometry(size * 1.5, 12, 12);
        const glowMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.1
        });
        mesh.add(new THREE.Mesh(glowGeo, glowMat));

        // Label
        const label = createTextSprite(node.label, color);
        label.position.set(0, size + 1.5, 0);
        label.scale.set(4, 2, 1);
        mesh.add(label);

        // Function count indicator (small ring if has functions)
        if (hasDefs) {
            const indicatorGeo = new THREE.RingGeometry(size * 1.2, size * 1.5, 24);
            const indicatorMat = new THREE.MeshBasicMaterial({
                color: 0xff8800,
                transparent: true,
                opacity: 0.5,
            });
            const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
            indicator.position.y = -size * 0.9;
            mesh.add(indicator);
        }

        if (parseStatus !== UI_PARSE_STATUS_FULL) {
            const parseMeta = getParseStatusMeta(parseStatus);
            const parseGeo = new THREE.RingGeometry(size * 1.05, size * 1.15, 20);
            const parseMat = new THREE.MeshBasicMaterial({
                color: parseMeta.accent,
                transparent: true,
                opacity: 0.8,
            });
            const parseIndicator = new THREE.Mesh(parseGeo, parseMat);
            parseIndicator.position.y = size * 0.95;
            mesh.add(parseIndicator);
        }

        if (savedPrefs.shape && savedPrefs.shape !== 'sphere') {
            setTimeout(() => setFolderShape(node.folder, savedPrefs.shape), 0);
        }
    }

    // Edges
    const edgeMaterial = new THREE.LineBasicMaterial({
        color: 0x1a3a5a,
        transparent: true,
        opacity: 0.25
    });

    for (const edge of graphData.edges) {
        const fromMesh = nodeMeshes.get(edge.from);
        const toMesh = nodeMeshes.get(edge.to);
        if (!fromMesh || !toMesh) continue;

        const points = [fromMesh.position.clone(), toMesh.position.clone()];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geo, edgeMaterial.clone());
        line.userData = { from: edge.from, to: edge.to };
        scene.add(line);
        edgeLines.push(line);
    }

    // Folder pillars
    for (const [folder, pos] of Object.entries(folderPositions)) {
        const color = getFolderColor(folder);

        const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, LAYER_HEIGHT * 2, 8);
        const pillarMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.15 });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(pos.x, pos.y, pos.z);
        scene.add(pillar);

        const label = createTextSprite(folder.toUpperCase(), color, 48);
        label.position.set(pos.x, pos.y + LAYER_HEIGHT + 5, pos.z);
        label.scale.set(12, 6, 1);
        scene.add(label);
    }
}
