// ============================================================
// SUGARSPACE CODE EXPLORER - 3D First-Person Codebase Flythrough
// Adapted from windsurf-project-4 game engine
// ============================================================

let scene, camera, renderer;
let playerGroup;
let isPointerLocked = false;
let gameStarted = false;

// Movement state
const keys = {};
let playerYaw = 0;
let playerPitch = 0;
const maxPitch = Math.PI / 2.2;
let mouseSensitivity = 0.002;

// Flying
let isFlying = true;
let verticalVelocity = 0;
const gravity = -0.015;
const groundLevel = -50;

// Speed
const baseSpeed = 0.8;
const boostMultiplier = 4;
let currentBoost = 1;

// Camera
let isThirdPerson = false;
let cameraDistance = 15;
const minCameraDistance = 3;
const maxCameraDistance = 50;

// Graph objects
const nodeMeshes = new Map();
const edgeLines = [];
let hoveredNode = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);

// Layout
const SPREAD = 8;
const LAYER_HEIGHT = 15;

// Folder colors
const FOLDER_COLORS = {
    'route':       0xe74c3c,
    'controller':  0x3498db,
    'service':     0x2ecc71,
    'entity':      0xf39c12,
    'middleware':   0x9b59b6,
    'monitoring':   0x1abc9c,
    'constants':    0xe67e22,
    'config':       0x16a085,
    'util':         0xd35400,
    'helper':       0x8e44ad,
    'migration':    0x7f8c8d,
    '_root':        0xecf0f1,
};

function getFolderColor(folder) {
    const lower = folder.toLowerCase();
    for (const [key, color] of Object.entries(FOLDER_COLORS)) {
        if (lower.includes(key)) return color;
    }
    // Generate deterministic color from folder name
    let hash = 0;
    for (let i = 0; i < folder.length; i++) {
        hash = folder.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (hash & 0x00FFFFFF);
}

// ============================================================
// GRAPH LAYOUT - Force-directed-ish with folder clustering
// ============================================================
function layoutGraph(nodes, edges) {
    // Group by folder
    const folders = {};
    for (const node of nodes) {
        if (!folders[node.folder]) folders[node.folder] = [];
        folders[node.folder].push(node);
    }

    const folderNames = Object.keys(folders);
    const folderCount = folderNames.length;

    // Place folders in a circle
    const folderPositions = {};
    const folderRadius = folderCount * SPREAD * 1.2;
    folderNames.forEach((name, i) => {
        const angle = (i / folderCount) * Math.PI * 2;
        folderPositions[name] = {
            x: Math.cos(angle) * folderRadius,
            z: Math.sin(angle) * folderRadius,
            y: 0
        };
    });

    // Place nodes within their folder cluster
    const positions = {};
    for (const [folder, folderNodes] of Object.entries(folders)) {
        const center = folderPositions[folder];
        const count = folderNodes.length;
        const clusterRadius = Math.sqrt(count) * SPREAD * 0.6;

        folderNodes.forEach((node, i) => {
            // Spiral layout within cluster
            const t = i / Math.max(count - 1, 1);
            const spiralAngle = t * Math.PI * 6;
            const spiralRadius = t * clusterRadius;
            const yOffset = (Math.random() - 0.5) * LAYER_HEIGHT;

            positions[node.id] = {
                x: center.x + Math.cos(spiralAngle) * spiralRadius,
                y: center.y + yOffset,
                z: center.z + Math.sin(spiralAngle) * spiralRadius
            };
        });
    }

    // Simple force repulsion pass (just 2 iterations to spread overlaps)
    for (let iter = 0; iter < 3; iter++) {
        const nodeIds = Object.keys(positions);
        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                const a = positions[nodeIds[i]];
                const b = positions[nodeIds[j]];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dz = b.z - a.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist < SPREAD * 1.5 && dist > 0.01) {
                    const force = (SPREAD * 1.5 - dist) * 0.3;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const nz = dz / dist;
                    a.x -= nx * force;
                    a.y -= ny * force;
                    a.z -= nz * force;
                    b.x += nx * force;
                    b.y += ny * force;
                    b.z += nz * force;
                }
            }
        }
    }

    return { positions, folderPositions };
}

// ============================================================
// INIT
// ============================================================
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);
    scene.fog = new THREE.FogExp2(0x050510, 0.003);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '0';
    document.body.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight(0x222244, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    // Player group (camera parent)
    playerGroup = new THREE.Group();
    playerGroup.position.set(0, 30, 80);
    scene.add(playerGroup);
    playerGroup.add(camera);
    camera.position.set(0, 2, 0);

    // Build the graph
    buildGraph();

    // Grid floor
    const gridHelper = new THREE.GridHelper(600, 60, 0x111133, 0x0a0a22);
    gridHelper.position.y = groundLevel;
    scene.add(gridHelper);

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starVerts = [];
    for (let i = 0; i < 3000; i++) {
        starVerts.push(
            (Math.random() - 0.5) * 1500,
            (Math.random() - 0.5) * 1500,
            (Math.random() - 0.5) * 1500
        );
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x444466, size: 0.8 });
    scene.add(new THREE.Points(starGeo, starMat));

    // Controls
    setupControls();

    // Stats
    document.getElementById('graphStats').textContent =
        `${graphData.nodes.length} files | ${graphData.edges.length} dependencies`;
    document.getElementById('hudNodes').textContent = graphData.nodes.length;
    document.getElementById('hudEdges').textContent = graphData.edges.length;

    // Build legend
    buildLegend();

    // Start render loop
    animate();
}

// ============================================================
// BUILD GRAPH SCENE
// ============================================================
function buildGraph() {
    const { positions, folderPositions } = layoutGraph(graphData.nodes, graphData.edges);

    // Create node meshes
    for (const node of graphData.nodes) {
        const pos = positions[node.id];
        if (!pos) continue;

        const color = getFolderColor(node.folder);
        const size = Math.max(0.5, Math.min(2.5, Math.sqrt(node.lines) * 0.1));

        // Main sphere
        const geo = new THREE.SphereGeometry(size, 12, 12);
        const mat = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.85
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.userData = { nodeData: node, baseColor: color, baseSize: size };
        scene.add(mesh);
        nodeMeshes.set(node.id, mesh);

        // Glow
        const glowGeo = new THREE.SphereGeometry(size * 1.5, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.08
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        mesh.add(glow);

        // Label sprite
        const label = createTextSprite(node.label, color);
        label.position.set(0, size + 1.2, 0);
        label.scale.set(4, 2, 1);
        mesh.add(label);
    }

    // Create edges
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

    // Folder label pillars
    for (const [folder, pos] of Object.entries(folderPositions)) {
        const color = getFolderColor(folder);

        // Pillar
        const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, LAYER_HEIGHT * 2, 6);
        const pillarMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.15 });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(pos.x, pos.y, pos.z);
        scene.add(pillar);

        // Folder name label
        const label = createTextSprite(folder.toUpperCase(), color, 48);
        label.position.set(pos.x, pos.y + LAYER_HEIGHT + 5, pos.z);
        label.scale.set(12, 6, 1);
        scene.add(label);
    }
}

function createTextSprite(text, color, fontSize) {
    fontSize = fontSize || 28;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.font = `bold ${fontSize}px Courier New`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(text, 258, 66);

    // Text
    const c = new THREE.Color(color);
    ctx.fillStyle = `rgb(${Math.floor(c.r*255)},${Math.floor(c.g*255)},${Math.floor(c.b*255)})`;
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    return new THREE.Sprite(mat);
}

function buildLegend() {
    const folders = new Set(graphData.nodes.map(n => n.folder));
    const container = document.getElementById('legendItems');
    container.innerHTML = '';
    for (const folder of folders) {
        const color = getFolderColor(folder);
        const hex = '#' + new THREE.Color(color).getHexString();
        const div = document.createElement('div');
        div.className = 'legend-item';
        div.innerHTML = `<div class="legend-dot" style="background:${hex}"></div>${folder}/`;
        container.appendChild(div);
    }
}

// ============================================================
// CONTROLS (adapted from windsurf-project-4/controls.js)
// ============================================================
function setupControls() {
    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (key === ' ') e.preventDefault();
        keys[key] = true;

        if (key === 'f' && gameStarted) {
            isFlying = !isFlying;
            if (!isFlying) verticalVelocity = 0;
        }
        if (key === 'c' && gameStarted) {
            isThirdPerson = !isThirdPerson;
            updateCameraView();
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
    });

    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = !!document.pointerLockElement;
    });

    renderer.domElement.addEventListener('click', () => {
        if (gameStarted && !isPointerLocked) {
            renderer.domElement.requestPointerLock();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isPointerLocked || !gameStarted) return;

        playerYaw -= e.movementX * mouseSensitivity;
        playerPitch -= e.movementY * mouseSensitivity;
        playerPitch = Math.max(-maxPitch, Math.min(maxPitch, playerPitch));

        const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw);
        const pitchQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), playerPitch);
        playerGroup.quaternion.copy(pitchQ).premultiply(yawQ);
    });

    renderer.domElement.addEventListener('wheel', (e) => {
        if (!gameStarted) return;
        cameraDistance += e.deltaY * 0.02;
        cameraDistance = Math.max(minCameraDistance, Math.min(maxCameraDistance, cameraDistance));
        updateCameraView();
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function updateCameraView() {
    if (isThirdPerson) {
        camera.position.set(0, 3, cameraDistance);
    } else {
        camera.position.set(0, 2, 0);
    }
}

// ============================================================
// MOVEMENT (adapted from windsurf-project-4/game-refactored.js)
// ============================================================
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

    // HUD
    const p = playerGroup.position;
    document.getElementById('hudPos').textContent =
        `${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
    document.getElementById('hudSpeed').textContent = currentBoost > 1 ? `${currentBoost}x BOOST` : '1x';
}

// ============================================================
// HOVER DETECTION
// ============================================================
function updateHover() {
    raycaster.setFromCamera(mouse, camera);

    const meshArray = Array.from(nodeMeshes.values());
    const intersects = raycaster.intersectObjects(meshArray, true);

    // Reset previous hover
    if (hoveredNode) {
        const prevMesh = nodeMeshes.get(hoveredNode.id);
        if (prevMesh) {
            prevMesh.material.emissiveIntensity = 0.3;
            prevMesh.scale.setScalar(1);
        }
        // Reset edges
        for (const line of edgeLines) {
            line.material.opacity = 0.25;
            line.material.color.setHex(0x1a3a5a);
        }
    }

    if (intersects.length > 0) {
        let target = intersects[0].object;
        while (target && !target.userData.nodeData) {
            target = target.parent;
        }

        if (target && target.userData.nodeData) {
            const node = target.userData.nodeData;
            hoveredNode = node;

            target.material.emissiveIntensity = 0.8;
            target.scale.setScalar(1.3);

            // Highlight connected edges
            for (const line of edgeLines) {
                if (line.userData.from === node.id || line.userData.to === node.id) {
                    line.material.opacity = 0.9;
                    line.material.color.setHex(0x00ff88);
                }
            }

            // Show file info
            const info = document.getElementById('fileInfo');
            info.style.display = 'block';
            document.getElementById('infoName').textContent = node.fullPath;
            const inEdges = graphData.edges.filter(e => e.to === node.id).length;
            const outEdges = graphData.edges.filter(e => e.from === node.id).length;
            document.getElementById('infoDetails').textContent =
                `${node.lines} lines | ${node.folder}/ | ${outEdges} imports | ${inEdges} imported by`;
        } else {
            hoveredNode = null;
            document.getElementById('fileInfo').style.display = 'none';
        }
    } else {
        hoveredNode = null;
        document.getElementById('fileInfo').style.display = 'none';
    }
}

// ============================================================
// MINIMAP
// ============================================================
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

    // Draw edges
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

    // Draw nodes
    for (const [id, mesh] of nodeMeshes) {
        const dx = (mesh.position.x - px) * scale;
        const dz = (mesh.position.z - pz) * scale;
        const sx = cx + dx;
        const sy = cy + dz;
        if (sx < -5 || sx > w + 5 || sy < -5 || sy > h + 5) continue;

        const c = new THREE.Color(mesh.userData.baseColor);
        ctx.fillStyle = `rgb(${Math.floor(c.r*255)},${Math.floor(c.g*255)},${Math.floor(c.b*255)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
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

    // Direction indicator
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(playerGroup.quaternion);
    ctx.strokeStyle = '#0f8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + fwd.x * 15, cy + fwd.z * 15);
    ctx.stroke();
}

// ============================================================
// ANIMATE
// ============================================================
function animate() {
    requestAnimationFrame(animate);

    if (gameStarted) {
        updateMovement();
        updateHover();
        updateMinimap();

        // Gentle node bobbing
        const time = Date.now() * 0.001;
        for (const [id, mesh] of nodeMeshes) {
            mesh.position.y += Math.sin(time + mesh.position.x * 0.1) * 0.003;
        }
    }

    renderer.render(scene, camera);
}

// ============================================================
// START
// ============================================================
window.startExplorer = function() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('crosshair').style.display = 'block';
    document.getElementById('hud').style.display = 'block';
    document.getElementById('legend').style.display = 'block';
    document.getElementById('minimap').style.display = 'block';

    gameStarted = true;
    renderer.domElement.requestPointerLock();
};

// Boot
init();
