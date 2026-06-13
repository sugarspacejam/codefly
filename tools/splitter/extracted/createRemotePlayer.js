function createRemotePlayer(data) {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8);
    const bodyMat = new THREE.MeshPhongMaterial({
        color: hslToHex(data.color),
        emissive: hslToHex(data.color),
        emissiveIntensity: 0.3,
        shininess: 30,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const headMat = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        emissive: hslToHex(data.color),
        emissiveIntensity: 0.2,
        shininess: 30,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.3;
    group.add(head);

    // Glow
    const glowGeo = new THREE.SphereGeometry(1.2, 8, 8);
    const glowMat = new THREE.MeshBasicMaterial({
        color: hslToHex(data.color),
        transparent: true,
        opacity: 0.08,
    });
    group.add(new THREE.Mesh(glowGeo, glowMat));

    // Name label
    const label = createTextSprite(data.nickname, hslToHex(data.color), 24);
    label.position.set(0, 2.5, 0);
    label.scale.set(4, 2, 1);
    group.add(label);

    if (data.position) {
        group.position.set(data.position.x, data.position.y, data.position.z);
    }

    scene.add(group);
    remotePlayers.set(data.id, {
        group: group,
        nickname: data.nickname,
        color: data.color,
        label: label,
    });
}
