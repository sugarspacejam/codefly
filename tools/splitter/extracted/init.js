function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);
    scene.fog = new THREE.FogExp2(0x050510, 0.003);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '0';
    document.body.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x222244, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    playerGroup = new THREE.Group();
    playerGroup.position.set(0, 30, 80);
    scene.add(playerGroup);
    playerGroup.add(camera);
    camera.position.set(0, 2, 0);

    buildAdjacency();
    buildGraph();
    nodeMeshArray = Array.from(nodeMeshes.values());
    updateRaycastTargets();
    hydrateLandmarks();
    importTourFromUrl();
    renderLandmarks();

    const gridHelper = new THREE.GridHelper(600, 60, 0x111133, 0x0a0a22);
    gridHelper.position.y = groundLevel;
    scene.add(gridHelper);

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

    setupControls();
    setupMotionControls();

    const langCount = graphData.meta && graphData.meta.languages
        ? Object.keys(graphData.meta.languages).length : 1;
    const parseSummary = graphData.meta && graphData.meta.parseSummary ? graphData.meta.parseSummary : {};
    const partialCount = Number(parseSummary.partial || 0);
    const unsupportedCount = Number(parseSummary.unsupported || 0);
    document.getElementById('graphStats').textContent =
        `${graphData.nodes.length} files | ${graphData.edges.length} deps | ${langCount} languages | ${partialCount + unsupportedCount} limited`;
    document.getElementById('hudNodes').textContent = graphData.nodes.length;
    document.getElementById('hudEdges').textContent = graphData.edges.length;

    const totalDefs = graphData.nodes.reduce((s, n) => s + (n.definitions ? n.definitions.length : 0), 0);
    document.getElementById('hudFunctions').textContent = totalDefs;

    buildLegend();
    animate();
}
