// ============================================================
// SUGARSPACE CODE EXPLORER - 3D First-Person Codebase Flythrough
// With multiplayer + function expansion
// ============================================================

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

let graphData = null;
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
let baseSpeed = 0.28;
const boostMultiplier = 4;
let currentBoost = 1;

// Motion settings
let orbitSpeed = 0.25;
let orbitPaused = false;

// Camera
let isThirdPerson = false;
let cameraDistance = 15;
const minCameraDistance = 3;
const maxCameraDistance = 50;

// Graph objects
const nodeMeshes = new Map();
let nodeMeshArray = [];  // cached for raycasting perf
let functionMeshArray = [];
let raycastTargets = [];
const edgeLines = [];
let hoveredNode = null;
let hoveredNodeId = null;
let hoveredMesh = null;
let hoveredFunctionMesh = null;
let selectedNodeId = null;
let churnHeatEnabled = false;
let isChurnLoading = false;
let churnByNodeId = {};
let blameByNodeId = {};
let blameEnabled = false;
let isBlameLoading = false;
let landmarkTourTimer = null;
const landmarks = [];
const collapsedFolders = new Set();
const FOLDER_PREFS_KEY = 'codefly_folder_prefs_v1';
const flyTarget = { active: false, from: null, to: null, progress: 0, durationFrames: 120 };
const PARSE_STATUS_FULL = 'full';
const PARSE_STATUS_PARTIAL = 'partial';
const PARSE_STATUS_UNSUPPORTED = 'unsupported';
const intentLexicon = {
    auth: ['auth', 'login', 'token', 'session', 'jwt', 'oauth', 'password'],
    payments: ['payment', 'billing', 'stripe', 'invoice', 'checkout', 'refund'],
    onboarding: ['onboarding', 'signup', 'welcome', 'invite'],
    notifications: ['notify', 'notification', 'email', 'sms', 'push'],
    api: ['api', 'route', 'controller', 'endpoint', 'handler'],
    data: ['db', 'database', 'model', 'schema', 'entity', 'repository'],
};
const activeCallChain = {
    nodeId: null,
    nodeIds: new Set(),
    outboundEdgeIndices: new Set(),
    inboundEdgeIndices: new Set(),
};
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);
const IDE_EDITORS = [
    { id: 'vscode', label: 'VS Code', icon: '🟦', scheme: 'vscode://file/{path}:{line}' },
    { id: 'cursor', label: 'Cursor', icon: '⚫', scheme: 'cursor://file/{path}:{line}' },
    { id: 'windsurf', label: 'Windsurf', icon: '🌊', scheme: 'windsurf://file/{path}:{line}' },
    { id: 'zed', label: 'Zed', icon: '⚡', scheme: 'zed://file/{path}:{line}' },
];

// Page visibility
let pageVisible = true;
document.addEventListener('visibilitychange', () => {
    pageVisible = !document.hidden;
});

// Reusable objects (avoid GC pressure in hot loops)
const _tmpColor = new THREE.Color();
const _tmpVec3 = new THREE.Vector3();

function getNodeParseStatus(node) {
    if (!node || !node.parseStatus) {
        return PARSE_STATUS_FULL;
    }
    return node.parseStatus;
}

function getParseStatusMeta(status) {
    if (status === PARSE_STATUS_UNSUPPORTED) {
        return { label: 'UNSUPPORTED', color: '#bbbbbb', accent: 0x9a9a9a };
    }
    if (status === PARSE_STATUS_PARTIAL) {
        return { label: 'PARTIAL', color: '#ffd65a', accent: 0xffd65a };
    }
    return { label: 'FULL', color: '#8f8', accent: 0x33ff99 };
}

function getNodePreviewLines(node) {
    if (!node) {
        return [];
    }
    if (Array.isArray(node.rawPreview) && node.rawPreview.length > 0) {
        return node.rawPreview;
    }
    if (Array.isArray(node.preview) && node.preview.length > 0) {
        return node.preview.slice(0, 3);
    }
    return [];
}

// Pre-computed adjacency for O(1) edge lookup
const adjacencyIn = {};
const adjacencyOut = {};
const adjacencyInList = {};
const adjacencyOutList = {};
const edgesByNode = {};
const edgesByPair = {};

// Function expansion state
const expandedNodes = new Set();
const functionMeshes = new Map();

// Multiplayer state
let ws = null;
let myPlayerId = null;
let myNickname = 'Explorer';
let wsReconnectDelay = 1000;
const remotePlayers = new Map();

const AUTH_STORAGE_KEY = 'codechat_auth_v1';
let authState = { provider: null, token: null, userLabel: null };
let githubDeviceFlow = { deviceCode: null, userCode: null, verificationUri: null, intervalSec: null, expiresInSec: null };
let gitlabPkce = { verifier: null, state: null };

function loadAuthState() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
        authState = { provider: null, token: null, userLabel: null };
        return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid auth state in localStorage');
    }
    authState = {
        provider: parsed.provider || null,
        token: parsed.token || null,
        userLabel: parsed.userLabel || null,
    };
}

function saveAuthState() {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
    updateAuthUi();
}

function updateAuthUi() {
    const el = document.getElementById('authStatus');
    const logoutBtn = document.getElementById('logoutBtn');
    if (!el) {
        return;
    }
    if (!authState.provider || !authState.token) {
        el.textContent = 'Not connected — public repos work without login';
        el.className = 'logged-out';
        if (logoutBtn) logoutBtn.style.display = 'none';
        return;
    }
    const label = authState.userLabel ? authState.userLabel : authState.provider;
    const providerIcon = authState.provider === 'github' ? '🐙' : '🦊';
    el.textContent = `${providerIcon} Connected as ${label}`;
    el.className = 'logged-in';
    if (logoutBtn) logoutBtn.style.display = 'flex';
}

function getGitHubTokenForApi() {
    if (authState.provider === 'github' && authState.token) {
        return authState.token;
    }
    const tokenInput = document.getElementById('ghTokenInput');
    const token = tokenInput ? tokenInput.value.trim() : '';
    return token;
}

function getGitLabTokenForApi() {
    if (authState.provider === 'gitlab' && authState.token) {
        return authState.token;
    }
    return '';
}

function getOAuthConfig() {
    const cfg = window.CODECHAT_OAUTH;
    if (!cfg) {
        return { githubClientId: '', gitlabClientId: '', gitlabRedirectUri: window.location.origin + window.location.pathname };
    }
    return cfg;
}

function base64UrlEncode(bytes) {
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
    }
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Base64Url(input) {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(digest));
}

function randomString(len) {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function openDeviceFlowModal(userCode) {
    const modal = document.getElementById('deviceFlowModal');
    const codeEl = document.getElementById('deviceFlowCode');
    if (!modal || !codeEl) {
        throw new Error('Device flow modal elements missing');
    }
    codeEl.textContent = userCode;
    modal.style.display = 'block';
    document.exitPointerLock();
}

window.closeDeviceFlow = function() {
    const modal = document.getElementById('deviceFlowModal');
    if (!modal) {
        throw new Error('Device flow modal missing');
    }
    modal.style.display = 'none';
};

window.openDeviceFlowUrl = function() {
    if (!githubDeviceFlow.verificationUri) {
        throw new Error('GitHub verification URL missing');
    }
    window.open(githubDeviceFlow.verificationUri, '_blank');
};

window.logoutAuth = function() {
    authState = { provider: null, token: null, userLabel: null };
    saveAuthState();
};

function openPatModal(provider) {
    const modal = document.getElementById('patModal');
    const title = document.getElementById('patModalTitle');
    const input = document.getElementById('patModalInput');
    const link = document.getElementById('patModalLink');
    if (!modal || !title || !input || !link) {
        throw new Error('PAT modal elements missing from DOM');
    }
    modal.dataset.provider = provider;
    if (provider === 'github') {
        title.textContent = 'Connect GitHub — Personal Access Token';
        input.placeholder = 'ghp_xxxxxxxxxxxxxxxxxxxx';
        link.href = 'https://github.com/settings/tokens/new?scopes=repo,read:user&description=CodeFly';
        link.textContent = 'Create GitHub token ↗';
    } else {
        title.textContent = 'Connect GitLab — Personal Access Token';
        input.placeholder = 'glpat-xxxxxxxxxxxxxxxxxxxx';
        link.href = 'https://gitlab.com/-/user_settings/personal_access_tokens?name=CodeFly&scopes=read_api,read_repository';
        link.textContent = 'Create GitLab token ↗';
    }
    input.value = '';
    modal.style.display = 'block';
}

window.closePatModal = function() {
    const modal = document.getElementById('patModal');
    if (!modal) {
        throw new Error('PAT modal missing');
    }
    modal.style.display = 'none';
};

window.savePatToken = async function() {
    const modal = document.getElementById('patModal');
    const input = document.getElementById('patModalInput');
    const errEl = document.getElementById('patModalError');
    if (!modal || !input || !errEl) {
        throw new Error('PAT modal elements missing');
    }
    const provider = modal.dataset.provider;
    const token = input.value.trim();
    if (!token) {
        errEl.textContent = 'Please enter a token';
        return;
    }
    errEl.textContent = 'Verifying…';
    try {
        let userLabel = provider;
        if (provider === 'github') {
            userLabel = await fetchGitHubViewerLogin(token);
        } else {
            const res = await fetch('https://gitlab.com/api/v4/user', {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
            });
            if (!res.ok) {
                throw new Error(`GitLab token verification failed: ${res.status}`);
            }
            const data = await res.json();
            if (!data || !data.username) {
                throw new Error('GitLab user response missing username');
            }
            userLabel = data.username;
        }
        authState = { provider, token, userLabel };
        saveAuthState();
        window.closePatModal();
    } catch (err) {
        errEl.textContent = err.message || 'Token verification failed';
    }
};

async function fetchGitHubViewerLogin(token) {
    const headers = { 'Accept': 'application/vnd.github.v3+json', 'Authorization': `token ${token}` };
    const res = await fetch('https://api.github.com/user', { headers });
    if (!res.ok) {
        throw new Error(`GitHub user fetch failed: ${res.status}`);
    }
    const data = await res.json();
    if (!data || !data.login) {
        throw new Error('GitHub user response missing login');
    }
    return data.login;
}

window.loginGitHub = async function() {
    const cfg = getOAuthConfig();
    const clientId = cfg.githubClientId;

    if (!clientId) {
        openPatModal('github');
        return;
    }

    const headers = { 'Accept': 'application/json' };
    const body = new URLSearchParams();
    body.set('client_id', clientId);

    const res = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers,
        body,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub device code request failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    if (!data.device_code || !data.user_code || !data.verification_uri || !data.interval || !data.expires_in) {
        throw new Error('GitHub device code response missing required fields');
    }

    githubDeviceFlow = {
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        intervalSec: data.interval,
        expiresInSec: data.expires_in,
    };

    openDeviceFlowModal(githubDeviceFlow.userCode);

    const start = Date.now();
    while (true) {
        const elapsed = (Date.now() - start) / 1000;
        if (elapsed > githubDeviceFlow.expiresInSec) {
            throw new Error('GitHub device flow expired. Please try again.');
        }

        await new Promise((r) => setTimeout(r, githubDeviceFlow.intervalSec * 1000));

        const tokenBody = new URLSearchParams();
        tokenBody.set('client_id', clientId);
        tokenBody.set('device_code', githubDeviceFlow.deviceCode);
        tokenBody.set('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');

        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers,
            body: tokenBody,
        });

        if (!tokenRes.ok) {
            const text = await tokenRes.text();
            throw new Error(`GitHub device token request failed: ${tokenRes.status} ${text}`);
        }

        const tokenData = await tokenRes.json();
        if (tokenData.error) {
            if (tokenData.error === 'authorization_pending') {
                continue;
            }
            if (tokenData.error === 'slow_down') {
                githubDeviceFlow.intervalSec += 2;
                continue;
            }
            throw new Error(`GitHub device flow error: ${tokenData.error}`);
        }

        if (!tokenData.access_token) {
            throw new Error('GitHub device flow completed but no access_token returned');
        }

        const login = await fetchGitHubViewerLogin(tokenData.access_token);
        authState = { provider: 'github', token: tokenData.access_token, userLabel: login };
        saveAuthState();
        window.closeDeviceFlow();
        return;
    }
};

window.loginGitLab = async function() {
    const cfg = getOAuthConfig();

    if (!cfg.gitlabClientId) {
        openPatModal('gitlab');
        return;
    }

    const verifier = randomString(64);
    const state = randomString(24);
    const challenge = await sha256Base64Url(verifier);

    gitlabPkce = { verifier, state };
    localStorage.setItem('codechat_gitlab_pkce', JSON.stringify(gitlabPkce));

    const url = new URL('https://gitlab.com/oauth/authorize');
    url.searchParams.set('client_id', cfg.gitlabClientId);
    url.searchParams.set('redirect_uri', cfg.gitlabRedirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'read_api');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');

    window.location.href = url.toString();
};

async function completeGitLabOAuthFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code && !state) {
        return;
    }
    if (!code) {
        throw new Error('GitLab OAuth callback missing code');
    }
    if (!state) {
        throw new Error('GitLab OAuth callback missing state');
    }

    const cfg = getOAuthConfig();
    const raw = localStorage.getItem('codechat_gitlab_pkce');
    if (!raw) {
        throw new Error('Missing GitLab PKCE verifier (localStorage)');
    }
    const pkce = JSON.parse(raw);
    if (!pkce || !pkce.verifier || !pkce.state) {
        throw new Error('Invalid GitLab PKCE verifier data');
    }
    if (pkce.state !== state) {
        throw new Error('GitLab OAuth state mismatch');
    }

    const body = new URLSearchParams();
    body.set('client_id', cfg.gitlabClientId);
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('redirect_uri', cfg.gitlabRedirectUri);
    body.set('code_verifier', pkce.verifier);

    const res = await fetch('https://gitlab.com/oauth/token', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitLab token exchange failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    if (!data.access_token) {
        throw new Error('GitLab token exchange succeeded but access_token missing');
    }

    authState = { provider: 'gitlab', token: data.access_token, userLabel: 'user' };
    saveAuthState();
    localStorage.removeItem('codechat_gitlab_pkce');

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('code');
    cleanUrl.searchParams.delete('state');
    window.history.replaceState({}, document.title, cleanUrl.toString());
}

// Layout
const SPREAD = 18;
const LAYER_HEIGHT = 30;
const LAYOUT_MODES = ['cluster', 'galaxy', 'filesystem'];
let layoutMode = 'cluster';

// Language colors
const LANG_COLORS = {
    javascript: 0xffd700,
    typescript: 0x00bfff,
    python: 0x3cb371,
    go: 0x00ced1,
    java:         0xb07219,
    'rust':       0xdea584,
    'csharp':     0x178600,
    'ruby':       0xcc342d,
    'php':        0x4f5d95,
    'swift':      0xf05138,
    'kotlin':     0xa97bff,
    'scala':      0xdc322f,
    'c':          0x555555,
    'cpp':        0xf34b7d,
};

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
    let hash = 0;
    for (let i = 0; i < folder.length; i++) {
        hash = folder.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (hash & 0x00FFFFFF);
}

function getFolderPrefs(folder) {
    const raw = localStorage.getItem(FOLDER_PREFS_KEY);
    if (!raw) return {};
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        throw new Error(`Invalid folder prefs JSON: ${err.message}`);
    }
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Folder prefs must be an object');
    }
    return parsed[folder] || {};
}

function saveFolderPref(folder, key, value) {
    const raw = localStorage.getItem(FOLDER_PREFS_KEY);
    let parsed = {};
    if (raw) {
        try {
            parsed = JSON.parse(raw);
        } catch (err) {
            throw new Error(`Invalid folder prefs JSON: ${err.message}`);
        }
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Folder prefs must be an object');
        }
    }
    if (!parsed[folder]) parsed[folder] = {};
    parsed[folder][key] = value;
    localStorage.setItem(FOLDER_PREFS_KEY, JSON.stringify(parsed));
}

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

function toggleFolderCollapse(folder) {
    if (!folder) {
        throw new Error('toggleFolderCollapse requires a folder name');
    }
    if (collapsedFolders.has(folder)) {
        collapsedFolders.delete(folder);
    } else {
        collapsedFolders.add(folder);
    }
    applyFolderCollapse();
}

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

// ============================================================
// PRE-COMPUTE ADJACENCY
// ============================================================
function buildAdjacency() {
    for (const node of graphData.nodes) {
        adjacencyIn[node.id] = 0;
        adjacencyOut[node.id] = 0;
        adjacencyInList[node.id] = [];
        adjacencyOutList[node.id] = [];
        edgesByNode[node.id] = [];
    }
    for (let i = 0; i < graphData.edges.length; i++) {
        const e = graphData.edges[i];
        adjacencyOut[e.from] = (adjacencyOut[e.from] || 0) + 1;
        adjacencyIn[e.to] = (adjacencyIn[e.to] || 0) + 1;
        if (!adjacencyOutList[e.from]) adjacencyOutList[e.from] = [];
        if (!adjacencyInList[e.to]) adjacencyInList[e.to] = [];
        adjacencyOutList[e.from].push(e.to);
        adjacencyInList[e.to].push(e.from);
        if (!edgesByNode[e.from]) edgesByNode[e.from] = [];
        if (!edgesByNode[e.to]) edgesByNode[e.to] = [];
        edgesByNode[e.from].push(i);
        edgesByNode[e.to].push(i);
        edgesByPair[`${e.from}->${e.to}`] = i;
    }
}

// ============================================================
// GRAPH LAYOUT
// ============================================================
function layoutGraph(nodes, edges) {
    const folders = {};
    for (const node of nodes) {
        if (!folders[node.folder]) folders[node.folder] = [];
        folders[node.folder].push(node);
    }

    const folderNames = Object.keys(folders);
    const folderCount = folderNames.length;

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

    const positions = {};
    for (const [folder, folderNodes] of Object.entries(folders)) {
        const center = folderPositions[folder];
        const count = folderNodes.length;
        const clusterRadius = Math.sqrt(count) * SPREAD * 0.6;

        folderNodes.forEach((node, i) => {
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

function layoutGalaxy(nodes) {
    const positions = {};
    const folderPositions = {};
    const folders = {};
    for (const node of nodes) {
        if (!folders[node.folder]) folders[node.folder] = [];
        folders[node.folder].push(node);
    }
    const folderNames = Object.keys(folders);
    const folderCount = folderNames.length;
    const baseRadius = folderCount * SPREAD * 0.9;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    folderNames.forEach((folder, i) => {
        const r = baseRadius * (0.6 + i / Math.max(folderCount - 1, 1));
        const angle = i * goldenAngle;
        folderPositions[folder] = { x: Math.cos(angle) * r, y: 0, z: Math.sin(angle) * r };
    });

    for (const [folder, folderNodes] of Object.entries(folders)) {
        const center = folderPositions[folder];
        const count = folderNodes.length;
        const spiralRadius = Math.sqrt(count) * SPREAD * 0.7;
        folderNodes.forEach((node, i) => {
            const t = i / Math.max(count - 1, 1);
            const angle = t * Math.PI * 8;
            const r = t * spiralRadius;
            positions[node.id] = {
                x: center.x + Math.cos(angle) * r,
                y: (i % 7) * 1.2,
                z: center.z + Math.sin(angle) * r,
            };
        });
    }

    return { positions, folderPositions };
}

function layoutFilesystem(nodes) {
    const positions = {};
    const folderPositions = {};
    const folders = {};
    for (const node of nodes) {
        if (!folders[node.folder]) folders[node.folder] = [];
        folders[node.folder].push(node);
    }
    const folderNames = Object.keys(folders).sort();
    const columnSpacing = SPREAD * 3;
    const rowSpacing = 2.2;
    const startX = -(folderNames.length - 1) * columnSpacing * 0.5;

    folderNames.forEach((folder, i) => {
        const x = startX + i * columnSpacing;
        folderPositions[folder] = { x, y: 0, z: 0 };
        const folderNodes = folders[folder].slice().sort((a, b) => a.label.localeCompare(b.label));
        folderNodes.forEach((node, idx) => {
            positions[node.id] = {
                x,
                y: idx * rowSpacing,
                z: 0,
            };
        });
    });

    return { positions, folderPositions };
}

function getLayoutPositions() {
    if (layoutMode === 'galaxy') return layoutGalaxy(graphData.nodes);
    if (layoutMode === 'filesystem') return layoutFilesystem(graphData.nodes);
    return layoutGraph(graphData.nodes, graphData.edges);
}

function rebuildEdges() {
    for (const line of edgeLines) {
        const fromMesh = nodeMeshes.get(line.userData.from);
        const toMesh = nodeMeshes.get(line.userData.to);
        if (!fromMesh || !toMesh) continue;
        const positions = line.geometry.attributes.position.array;
        positions[0] = fromMesh.position.x;
        positions[1] = fromMesh.position.y;
        positions[2] = fromMesh.position.z;
        positions[3] = toMesh.position.x;
        positions[4] = toMesh.position.y;
        positions[5] = toMesh.position.z;
        line.geometry.attributes.position.needsUpdate = true;
    }
}

function rebuildGraphLayout() {
    const { positions } = getLayoutPositions();
    for (const [id, mesh] of nodeMeshes) {
        const pos = positions[id];
        if (!pos) continue;
        mesh.userData.targetPos = new THREE.Vector3(pos.x, pos.y, pos.z);
        mesh.userData.baseY = pos.y;
    }
    rebuildEdges();
    applyFolderCollapse();
}

window.cycleLayoutMode = function() {
    const currentIdx = LAYOUT_MODES.indexOf(layoutMode);
    const nextIdx = (currentIdx + 1) % LAYOUT_MODES.length;
    layoutMode = LAYOUT_MODES[nextIdx];
    rebuildGraphLayout();
    const label = layoutMode.toUpperCase();
    const btn = document.getElementById('layoutModeBtn');
    if (btn) btn.textContent = `Layout: ${label} [L]`;
    const stats = document.getElementById('graphStats');
    if (stats) stats.textContent = `Layout: ${label}`;
    setTimeout(() => { if (stats) stats.textContent = ''; }, 2000);
};

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

function setupMotionControls() {
    const panel = document.getElementById('motionControls');
    const moveSlider = document.getElementById('moveSpeedSlider');
    const orbitSlider = document.getElementById('orbitSpeedSlider');
    const pauseCheckbox = document.getElementById('pauseOrbitCheckbox');

    if (!panel) {
        throw new Error('motionControls element missing from DOM');
    }
    if (!moveSlider) {
        throw new Error('moveSpeedSlider element missing from DOM');
    }
    if (!orbitSlider) {
        throw new Error('orbitSpeedSlider element missing from DOM');
    }
    if (!pauseCheckbox) {
        throw new Error('pauseOrbitCheckbox element missing from DOM');
    }

    panel.style.display = 'block';

    const moveVal = Number(moveSlider.value);
    if (!Number.isFinite(moveVal)) {
        throw new Error('moveSpeedSlider value is invalid');
    }
    baseSpeed = moveVal;

    const orbitVal = Number(orbitSlider.value);
    if (!Number.isFinite(orbitVal)) {
        throw new Error('orbitSpeedSlider value is invalid');
    }
    orbitSpeed = orbitVal;

    orbitPaused = !!pauseCheckbox.checked;

    moveSlider.addEventListener('input', () => {
        const v = Number(moveSlider.value);
        if (!Number.isFinite(v)) {
            throw new Error('moveSpeedSlider value is invalid');
        }
        baseSpeed = v;
    });

    orbitSlider.addEventListener('input', () => {
        const v = Number(orbitSlider.value);
        if (!Number.isFinite(v)) {
            throw new Error('orbitSpeedSlider value is invalid');
        }
        orbitSpeed = v;
    });

    pauseCheckbox.addEventListener('change', () => {
        orbitPaused = !!pauseCheckbox.checked;
    });
}

// ============================================================
// BUILD GRAPH SCENE
// ============================================================
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
        if (parseStatus === PARSE_STATUS_UNSUPPORTED) {
            color = 0x6c6c6c;
        }
        const size = Math.max(0.5, Math.min(2.5, Math.sqrt(node.lines) * 0.1));
        const hasDefs = node.definitions && node.definitions.length > 0;
        const opacity = parseStatus === PARSE_STATUS_UNSUPPORTED ? 0.58 : parseStatus === PARSE_STATUS_PARTIAL ? 0.85 : 1;

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

        if (parseStatus !== PARSE_STATUS_FULL) {
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

// ============================================================
// FUNCTION EXPANSION - Click a file node to show orbiting functions
// ============================================================
function toggleFunctionExpansion(nodeId) {
    if (expandedNodes.has(nodeId)) {
        collapseFunctions(nodeId);
    } else {
        expandFunctions(nodeId);
    }
}

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

function collapseFunctions(nodeId) {
    expandedNodes.delete(nodeId);
    const fnMeshes = functionMeshes.get(nodeId);
    if (fnMeshes) {
        for (const { mesh, line } of fnMeshes) {
            scene.remove(mesh);
            scene.remove(line);
            mesh.geometry.dispose();
            mesh.material.dispose();
            line.geometry.dispose();
            line.material.dispose();
        }
        functionMeshes.delete(nodeId);
    }
    updateFunctionRaycastTargets(nodeId);
    document.getElementById('functionPanel').style.display = 'none';
}

function updateRaycastTargets() {
    raycastTargets = nodeMeshArray.concat(functionMeshArray);
}

function updateFunctionRaycastTargets(nodeId) {
    if (!functionMeshes.has(nodeId)) {
        functionMeshArray = functionMeshArray.filter((mesh) => mesh.userData.parentNodeId !== nodeId);
        updateRaycastTargets();
        return;
    }
    const fnMeshes = functionMeshes.get(nodeId);
    if (!fnMeshes) {
        return;
    }
    for (const { mesh } of fnMeshes) {
        if (!functionMeshArray.includes(mesh)) {
            functionMeshArray.push(mesh);
        }
    }
    updateRaycastTargets();
}

function resetCallChainHighlight() {
    for (const nodeId of activeCallChain.nodeIds) {
        const mesh = nodeMeshes.get(nodeId);
        if (mesh) {
            mesh.material.emissiveIntensity = 0.3;
            mesh.scale.setScalar(1);
        }
    }
    for (const idx of activeCallChain.outboundEdgeIndices) {
        if (edgeLines[idx]) {
            edgeLines[idx].material.opacity = 0.25;
            edgeLines[idx].material.color.setHex(0x1a3a5a);
        }
    }
    for (const idx of activeCallChain.inboundEdgeIndices) {
        if (edgeLines[idx]) {
            edgeLines[idx].material.opacity = 0.25;
            edgeLines[idx].material.color.setHex(0x1a3a5a);
        }
    }
    activeCallChain.nodeIds.clear();
    activeCallChain.outboundEdgeIndices.clear();
    activeCallChain.inboundEdgeIndices.clear();
    activeCallChain.nodeId = null;
}

function computeCallChain(nodeId, maxDepth) {
    const nodeIds = new Set();
    const outboundEdgeIndices = new Set();
    const inboundEdgeIndices = new Set();

    if (!nodeId) {
        return { nodeIds, outboundEdgeIndices, inboundEdgeIndices };
    }

    nodeIds.add(nodeId);

    const traverse = (startId, adjacency, edgeDirection, edgeSet) => {
        const queue = [{ id: startId, depth: 0 }];
        const visited = new Set([startId]);

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            if (current.depth >= maxDepth) {
                continue;
            }
            const nextIds = adjacency[current.id];
            if (!nextIds) {
                continue;
            }
            for (const nextId of nextIds) {
                nodeIds.add(nextId);
                const edgeKey = edgeDirection === 'out' ? `${current.id}->${nextId}` : `${nextId}->${current.id}`;
                const edgeIndex = edgesByPair[edgeKey];
                if (edgeIndex !== undefined) {
                    edgeSet.add(edgeIndex);
                }
                if (!visited.has(nextId)) {
                    visited.add(nextId);
                    queue.push({ id: nextId, depth: current.depth + 1 });
                }
            }
        }
    };

    traverse(nodeId, adjacencyOutList, 'out', outboundEdgeIndices);
    traverse(nodeId, adjacencyInList, 'in', inboundEdgeIndices);

    return { nodeIds, outboundEdgeIndices, inboundEdgeIndices };
}

function applyCallChainHighlight(nodeId) {
    const maxDepth = 3;
    const chain = computeCallChain(nodeId, maxDepth);

    for (const id of chain.nodeIds) {
        const mesh = nodeMeshes.get(id);
        if (mesh) {
            mesh.material.emissiveIntensity = 0.55;
            mesh.scale.setScalar(1.15);
        }
    }

    for (const idx of chain.outboundEdgeIndices) {
        if (edgeLines[idx]) {
            edgeLines[idx].material.opacity = 0.9;
            edgeLines[idx].material.color.setHex(0x00ff88);
        }
    }

    for (const idx of chain.inboundEdgeIndices) {
        if (edgeLines[idx]) {
            edgeLines[idx].material.opacity = 0.85;
            edgeLines[idx].material.color.setHex(0x5cc8ff);
        }
    }

    activeCallChain.nodeId = nodeId;
    activeCallChain.nodeIds = chain.nodeIds;
    activeCallChain.outboundEdgeIndices = chain.outboundEdgeIndices;
    activeCallChain.inboundEdgeIndices = chain.inboundEdgeIndices;
}

function resolveHoverTarget(intersects) {
    if (!intersects || intersects.length === 0) {
        return null;
    }

    let target = intersects[0].object;
    while (target && !target.userData.isFileNode && !target.userData.isFunctionNode) {
        target = target.parent;
    }

    if (!target) {
        return null;
    }

    if (target.userData.isFunctionNode) {
        const parentNodeId = target.userData.parentNodeId;
        if (!parentNodeId) {
            return null;
        }
        const parentMesh = nodeMeshes.get(parentNodeId);
        if (!parentMesh || !parentMesh.userData.nodeData) {
            return null;
        }
        return {
            node: parentMesh.userData.nodeData,
            mesh: parentMesh,
            functionMesh: target,
        };
    }

    if (!target.userData.nodeData) {
        return null;
    }

    return {
        node: target.userData.nodeData,
        mesh: target,
        functionMesh: null,
    };
}

function updateFunctionPanel(node) {
    const panel = document.getElementById('functionPanel');
    const list = document.getElementById('functionList');
    const parseMeta = getParseStatusMeta(getNodeParseStatus(node));
    panel.style.display = 'block';
    document.getElementById('functionFileName').textContent = node.fullPath;
    document.getElementById('functionCount').textContent = `${node.definitions.length} definitions · ${parseMeta.label}`;

    list.innerHTML = '';
    for (const def of node.definitions) {
        const div = document.createElement('div');
        div.className = 'fn-item';
        const kindTag = def.kind === 'class' ? 'cls' : def.kind === 'variable' ? 'var' : 'fn';
        const kindClr = def.kind === 'class' ? '#0cf' : def.kind === 'variable' ? '#c6f' : '#f80';
        div.innerHTML = `<span style="color:${kindClr}">[${kindTag}]</span> <span class="fn-name">${escapeHtml(def.name)}</span><span class="fn-line">:${def.line}</span>`;
        div.onclick = () => openIdePicker(node, def.line);
        list.appendChild(div);
    }
}

function showNodeFallbackPanel(node) {
    const panel = document.getElementById('functionPanel');
    const list = document.getElementById('functionList');
    const parseMeta = getParseStatusMeta(getNodeParseStatus(node));
    const parseReason = node.parseReason || 'No parser details available';
    const previewLines = getNodePreviewLines(node);
    const previewHtml = previewLines.length > 0
        ? `<div style="margin-top:8px; color:#aaa; font-size:11px; line-height:1.5;">${previewLines.map((line) => escapeHtml(line)).join('<br>')}</div>`
        : '<div style="margin-top:8px; color:#666; font-size:11px;">No preview available.</div>';

    panel.style.display = 'block';
    document.getElementById('functionFileName').textContent = node.fullPath;
    document.getElementById('functionCount').textContent = `0 definitions · ${parseMeta.label}`;
    list.innerHTML = `
        <div class="fn-item" style="border-bottom:none; padding:2px 0 0;">
            <div style="color:${parseMeta.color}; font-weight:bold; margin-bottom:6px;">${parseMeta.label} PARSE</div>
            <div style="color:#ccc; font-size:12px; line-height:1.5;">${escapeHtml(parseReason)}</div>
            ${previewHtml}
        </div>
    `;
}

let fileLayoutMode = false;

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

// ============================================================
// MULTIPLAYER — Cloudflare Durable Objects
// Each repo URL = one persistent room
// ============================================================

// Set this to your deployed Cloudflare Worker URL after `wrangler deploy`
const MULTIPLAYER_HOST = window.CODEFLY_MULTIPLAYER_HOST || '';

// Assign each browser session a stable random color
const myColor = `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`;

function connectMultiplayer() {
    if (!MULTIPLAYER_HOST) {
        document.getElementById('onlineCount').textContent = '1';
        return;
    }

    if (!graphData || !graphData.meta || !graphData.meta.repo) {
        document.getElementById('onlineCount').textContent = '1';
        return;
    }

    if (graphData.meta.provider === 'local') {
        document.getElementById('onlineCount').textContent = '1';
        return;
    }

    const roomId = encodeURIComponent(graphData.meta.repo);
    const wsUrl = `${MULTIPLAYER_HOST.replace(/^http/, 'ws')}/room/${roomId}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        wsReconnectDelay = 1000;
        document.getElementById('onlineCount').textContent = '1';
        sendPositionUpdate();
    };

    ws.onmessage = (event) => {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            return;
        }

        if (msg.type === 'presence_snapshot') {
            // Full snapshot of all other users in the room
            const incomingIds = new Set(msg.users.map((u) => u.id));

            // Remove players who left
            for (const [id] of remotePlayers) {
                if (!incomingIds.has(id)) {
                    removeRemotePlayer(id);
                }
            }

            // Add or update players
            for (const user of msg.users) {
                if (user.id === myPlayerId) continue;
                if (!remotePlayers.has(user.id)) {
                    createRemotePlayer({
                        id: user.id,
                        nickname: user.nickname,
                        color: user.color,
                        position: { x: user.x, y: user.y, z: user.z },
                    });
                    addChatMessage(`${user.nickname} is here`, '#0f8');
                } else {
                    updateRemotePlayer(
                        user.id,
                        { x: user.x, y: user.y, z: user.z },
                        { yaw: user.yaw },
                        user.nickname
                    );
                }
            }
            updateOnlineCount();
        }

        if (msg.type === 'chat') {
            addChatMessage(`${msg.nickname}: ${msg.text}`, '#8ff');
        }

        if (msg.type === 'leave') {
            removeRemotePlayer(msg.id);
            updateOnlineCount();
        }
    };

    ws.onclose = () => {
        document.getElementById('onlineCount').textContent = '0';
        const delay = Math.min(wsReconnectDelay, 30000);
        setTimeout(connectMultiplayer, delay);
        wsReconnectDelay = Math.min(wsReconnectDelay * 2, 30000);
    };

    ws.onerror = () => {};
}

function sendPositionUpdate() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
        type: 'presence',
        x: playerGroup.position.x,
        y: playerGroup.position.y,
        z: playerGroup.position.z,
        yaw: playerYaw,
        nickname: myNickname,
        color: myColor,
        nodeId: hoveredNodeId || null,
    }));
}

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

function updateRemotePlayer(playerId, position, rotation, nickname) {
    const rp = remotePlayers.get(playerId);
    if (!rp) return;

    // Smooth interpolation
    rp.group.position.lerp(_tmpVec3.set(position.x, position.y, position.z), 0.15);

    if (rotation) {
        const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation.yaw);
        rp.group.quaternion.slerp(yawQ, 0.15);
    }

    if (nickname && nickname !== rp.nickname) {
        rp.nickname = nickname;
        updateRemotePlayerLabel(playerId);
    }
}

function updateRemotePlayerLabel(playerId) {
    const rp = remotePlayers.get(playerId);
    if (!rp) return;
    rp.group.remove(rp.label);
    rp.label.material.dispose();
    rp.label.material.map.dispose();
    const newLabel = createTextSprite(rp.nickname, hslToHex(rp.color), 24);
    newLabel.position.set(0, 2.5, 0);
    newLabel.scale.set(4, 2, 1);
    rp.group.add(newLabel);
    rp.label = newLabel;
}

function removeRemotePlayer(playerId) {
    const rp = remotePlayers.get(playerId);
    if (!rp) return;
    addChatMessage(`${rp.nickname} left`, '#f88');
    scene.remove(rp.group);
    remotePlayers.delete(playerId);
}

function updateOnlineCount() {
    document.getElementById('onlineCount').textContent = remotePlayers.size + 1;
    const list = document.getElementById('playerListItems');
    list.innerHTML = `<div class="player-item" style="color:#0f8">${escapeHtml(myNickname)} (you)</div>`;
    for (const [id, rp] of remotePlayers) {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.style.color = '#8ff';
        div.textContent = rp.nickname; // textContent is already safe
        list.appendChild(div);
    }
}

function hslToHex(hslStr) {
    if (typeof hslStr === 'number') return hslStr;
    const match = hslStr.match(/hsl\((\d+)/);
    if (!match) return 0xffffff;
    const h = parseInt(match[1]) / 360;
    const s = 1;
    const l = 0.6;
    const c = new THREE.Color().setHSL(h, s, l);
    return c.getHex();
}

// ============================================================
// CHAT
// ============================================================
function addChatMessage(text, color) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.style.color = color || '#ccc';
    div.style.marginBottom = '2px';
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    // Keep max 50 messages
    while (container.children.length > 50) {
        container.removeChild(container.firstChild);
    }
}

function sendChat(text) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'chat', text, nickname: myNickname, color: myColor }));
    addChatMessage(`${myNickname}: ${text}`, '#0f8');
}

// ============================================================
// TEXT SPRITE
// ============================================================
function createTextSprite(text, color, fontSize) {
    fontSize = fontSize || 28;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.font = `bold ${fontSize}px Courier New`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const c = new THREE.Color(color);
    ctx.fillStyle = `rgb(${Math.floor(c.r*255)},${Math.floor(c.g*255)},${Math.floor(c.b*255)})`;
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

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

    // Language legend
    if (graphData.meta && graphData.meta.languages) {
        const langDiv = document.createElement('div');
        langDiv.style.marginTop = '8px';
        langDiv.style.borderTop = '1px solid #333';
        langDiv.style.paddingTop = '6px';
        langDiv.innerHTML = '<div style="font-weight:bold;color:#fff;margin-bottom:4px">LANGUAGES</div>';
        for (const [lang, count] of Object.entries(graphData.meta.languages)) {
            const lc = LANG_COLORS[lang] || 0x888888;
            const hex = '#' + new THREE.Color(lc).getHexString();
            const d = document.createElement('div');
            d.className = 'legend-item';
            d.innerHTML = `<div class="legend-dot" style="background:${hex}"></div>${lang} (${count})`;
            langDiv.appendChild(d);
        }
        container.appendChild(langDiv);
    }
}

// ============================================================
// CONTROLS
// ============================================================
function setupControls() {
    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();

        // Don't capture keys when typing in chat
        if (document.activeElement && document.activeElement.id === 'chatInput') return;

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
        if (key === 'enter' && gameStarted) {
            const chatInput = document.getElementById('chatInput');
            if (chatInput.style.display === 'none' || chatInput.style.display === '') {
                chatInput.style.display = 'block';
                chatInput.focus();
                document.exitPointerLock();
            }
        }
        if (key === 'tab' && gameStarted) {
            e.preventDefault();
            const pl = document.getElementById('playerList');
            pl.style.display = pl.style.display === 'block' ? 'none' : 'block';
        }
        if (key === 'g' && gameStarted) {
            const ap = document.getElementById('analyticsPanel');
            if (ap.style.display === 'block') {
                ap.style.display = 'none';
            } else {
                ap.style.display = 'block';
                document.exitPointerLock();
                buildAnalyticsFilters();
            }
        }
        if (key === 'k' && (e.ctrlKey || e.metaKey) && gameStarted) {
            e.preventDefault();
            const overlay = document.getElementById('searchOverlay');
            if (overlay.style.display === 'block') {
                closeSearch();
            } else {
                openSearch();
            }
        }
        if (key === 'l' && gameStarted && e.shiftKey) {
            if (hoveredNode) {
                addLandmark(hoveredNode);
            }
        }
        if (key === 'l' && gameStarted && !e.shiftKey) {
            window.cycleLayoutMode();
        }
        if (key === 'b' && gameStarted && selectedNodeId) {
            showBlastRadius();
        }
        if (key === 'o' && gameStarted && hoveredNode) {
            openIdePicker(hoveredNode, null);
        }
        if (key === 'v' && gameStarted) {
            fileLayoutMode = !fileLayoutMode;
            const currently = [...expandedNodes];
            for (const nid of currently) {
                collapseFunctions(nid);
                expandFunctions(nid);
            }
            const stats = document.getElementById('graphStats');
            if (stats) stats.textContent = fileLayoutMode ? 'View: FILE LAYOUT (vertical)' : 'View: ORBIT mode';
            setTimeout(() => { if (stats) stats.textContent = ''; }, 2000);
        }
        if (key === 'p' && gameStarted) {
            const panel = document.getElementById('folderSettingsPanel');
            if (!panel) {
                throw new Error('folderSettingsPanel element missing from DOM');
            }
            if (panel.style.display === 'block') {
                window.closeFolderSettings();
            } else {
                openFolderSettings();
            }
        }
        if (key === 'm' && gameStarted) {
            const panel = document.getElementById('motionControls');
            if (!panel) {
                throw new Error('motionControls element missing from DOM');
            }
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
        if (key === 'escape' && gameStarted) {
            closeSearch();
            document.getElementById('analyticsPanel').style.display = 'none';
        }
    });

    document.addEventListener('keyup', (e) => {
        if (document.activeElement && document.activeElement.id === 'chatInput') return;
        keys[e.key.toLowerCase()] = false;
    });

    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = !!document.pointerLockElement;
    });

    renderer.domElement.addEventListener('click', (e) => {
        if (gameStarted && !isPointerLocked) {
            renderer.domElement.requestPointerLock();
            return;
        }

        if (!gameStarted || !isPointerLocked) {
            return;
        }

        if (hoveredFunctionMesh) {
            const ud = hoveredFunctionMesh.userData;
            const parentMesh = nodeMeshes.get(ud.parentNodeId);
            if (!parentMesh || !parentMesh.userData.nodeData) {
                throw new Error('Function node has no valid parent node data');
            }
            openIdePicker(parentMesh.userData.nodeData, ud.functionLine);
        } else if (hoveredNode) {
            selectedNodeId = hoveredNode.id;
            resetCallChainHighlight();
            applyCallChainHighlight(selectedNodeId);
            if (hoveredNode.definitions && hoveredNode.definitions.length > 0) {
                toggleFunctionExpansion(hoveredNode.id);
            } else {
                showNodeFallbackPanel(hoveredNode);
            }
        } else {
            selectedNodeId = null;
            resetCallChainHighlight();
            document.getElementById('functionPanel').style.display = 'none';
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
        renderer.setPixelRatio(window.devicePixelRatio);
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
// MOVEMENT
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

    const p = playerGroup.position;
    document.getElementById('hudPos').textContent =
        `${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
    document.getElementById('hudSpeed').textContent = currentBoost > 1 ? `${currentBoost}x BOOST` : '1x';
}

// ============================================================
// HOVER DETECTION (uses pre-computed adjacency)
// ============================================================
function updateHover() {
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(raycastTargets, true);
    const hoverTarget = resolveHoverTarget(intersects);

    if (hoveredMesh && hoveredMesh !== hoverTarget?.mesh) {
        hoveredMesh.material.emissiveIntensity = 0.3;
        hoveredMesh.scale.setScalar(1);
    }

    if (hoveredFunctionMesh && hoveredFunctionMesh !== hoverTarget?.functionMesh) {
        hoveredFunctionMesh.material.emissiveIntensity = 0.4;
        hoveredFunctionMesh.scale.setScalar(1);
    }

    if (!hoverTarget) {
        hoveredNode = null;
        hoveredNodeId = null;
        hoveredMesh = null;
        hoveredFunctionMesh = null;
        if (!selectedNodeId) {
            resetCallChainHighlight();
        }
        const tt = document.getElementById('hoverTooltip');
        if (tt) tt.style.display = 'none';
        document.getElementById('previewCard').style.display = 'none';
        return;
    }

    hoveredNode = hoverTarget.node;
    hoveredNodeId = hoverTarget.node.id;
    hoveredMesh = hoverTarget.mesh;
    hoveredFunctionMesh = hoverTarget.functionMesh;

    hoveredMesh.material.emissiveIntensity = 0.8;
    hoveredMesh.scale.setScalar(1.3);

    if (hoveredFunctionMesh) {
        hoveredFunctionMesh.material.emissiveIntensity = 0.8;
        hoveredFunctionMesh.scale.setScalar(1.15);
    }

    if (!selectedNodeId) {
        resetCallChainHighlight();
        applyCallChainHighlight(hoveredNodeId);
    }

    // Show compact hover tooltip (top-left, non-blocking)
    const inE = adjacencyIn[hoveredNodeId] || 0;
    const outE = adjacencyOut[hoveredNodeId] || 0;
    const fnCount = hoveredNode.definitions ? hoveredNode.definitions.length : 0;
    const sizeLabel = hoveredNode.size ? ` · ${(hoveredNode.size / 1024).toFixed(1)}KB` : '';
    const parseMeta = getParseStatusMeta(getNodeParseStatus(hoveredNode));
    const parseLabel = ` <span style="color:${parseMeta.color}">[${parseMeta.label}]</span>`;
    const tooltip = document.getElementById('hoverTooltip');
    if (tooltip) {
        tooltip.innerHTML = `<span style="color:#fff;font-weight:bold">${escapeHtml(hoveredNode.fullPath)}</span><br><span style="color:#8f8">${hoveredNode.lines} lines${sizeLabel} · ${hoveredNode.lang || ''}</span>${parseLabel}  <span style="color:#5cc">↑${inE} ↓${outE}</span>  <span style="color:#f80">${fnCount > 0 ? fnCount + ' defs — click to expand' : 'click for file details'}</span>`;
        tooltip.style.display = 'block';
    }
    document.getElementById('previewCard').style.display = 'none';
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

// ============================================================
// ANALYTICS & FILTERS
// ============================================================
function highlightNodes(matchingIds, resultLabel) {
    const matchSet = new Set(matchingIds);
    for (const [id, mesh] of nodeMeshes) {
        if (matchSet.has(id)) {
            mesh.material.opacity = 1;
            mesh.material.emissiveIntensity = 0.8;
            mesh.material.transparent = false;
            mesh.scale.setScalar(1.5);
        } else {
            mesh.material.opacity = 0.08;
            mesh.material.emissiveIntensity = 0.05;
            mesh.material.transparent = true;
            mesh.scale.setScalar(0.5);
        }
    }
    for (const line of edgeLines) {
        const fromMatch = matchSet.has(line.userData.from);
        const toMatch = matchSet.has(line.userData.to);
        if (fromMatch && toMatch) {
            line.material.opacity = 0.8;
            line.material.color.setHex(0x00ff88);
        } else if (fromMatch || toMatch) {
            line.material.opacity = 0.15;
            line.material.color.setHex(0x1a3a5a);
        } else {
            line.material.opacity = 0.02;
            line.material.color.setHex(0x1a3a5a);
        }
    }
    showResults(matchingIds, resultLabel);
}

function setActiveFilterButton(labelText) {
    const buttons = document.querySelectorAll('.ap-btn');
    buttons.forEach((btn) => {
        if (btn.textContent.trim() === labelText.trim()) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function showResults(ids, label) {
    const container = document.getElementById('analyticsResults');
    container.innerHTML = `<div style="color:#ff0;margin-bottom:4px;">${label}: ${ids.length}</div>`;
    for (const id of ids.slice(0, 30)) {
        const div = document.createElement('div');
        div.className = 'ap-result';
        div.textContent = id;
        div.onclick = () => flyToNode(id);
        container.appendChild(div);
    }
    if (ids.length > 30) {
        const more = document.createElement('div');
        more.style.color = '#666';
        more.textContent = `... and ${ids.length - 30} more`;
        container.appendChild(more);
    }
}

function flyToNode(nodeId) {
    const mesh = nodeMeshes.get(nodeId);
    if (!mesh) return;
    const target = mesh.position.clone();
    target.z += 20;
    target.y += 5;
    flyTarget.active = true;
    flyTarget.from = playerGroup.position.clone();
    flyTarget.to = target;
    flyTarget.progress = 0;
}

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
};

window.filterOrphans = function() {
    const imported = new Set();
    const imports = new Set();
    for (const e of graphData.edges) {
        imported.add(e.to);
        imports.add(e.from);
    }
    const orphans = graphData.nodes
        .filter(n => !imported.has(n.id) && !imports.has(n.id))
        .map(n => n.id);
    highlightNodes(orphans, 'Orphan files (no imports, not imported)');
};

window.filterHubs = function() {
    const connections = {};
    for (const e of graphData.edges) {
        connections[e.from] = (connections[e.from] || 0) + 1;
        connections[e.to] = (connections[e.to] || 0) + 1;
    }
    const sorted = Object.entries(connections)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([id]) => id);
    highlightNodes(sorted, 'Top 20 most connected files');
};

window.filterLargest = function() {
    const sorted = [...graphData.nodes]
        .sort((a, b) => b.lines - a.lines)
        .slice(0, 20)
        .map(n => n.id);
    highlightNodes(sorted, 'Top 20 largest files');
};

window.filterCircular = function() {
    const adj = {};
    for (const e of graphData.edges) {
        if (!adj[e.from]) adj[e.from] = [];
        adj[e.from].push(e.to);
    }
    const inCycle = new Set();
    const visited = new Set();
    const stack = new Set();
    function dfs(node, path) {
        if (stack.has(node)) {
            const cycleStart = path.indexOf(node);
            for (let i = cycleStart; i < path.length; i++) inCycle.add(path[i]);
            return;
        }
        if (visited.has(node)) return;
        visited.add(node);
        stack.add(node);
        path.push(node);
        for (const next of (adj[node] || [])) {
            dfs(next, path);
        }
        path.pop();
        stack.delete(node);
    }
    for (const n of graphData.nodes) dfs(n.id, []);
    highlightNodes([...inCycle], 'Files in circular dependencies');
};

window.filterNoDefinitions = function() {
    const ids = graphData.nodes
        .filter(n => !n.definitions || n.definitions.length === 0)
        .map(n => n.id);
    highlightNodes(ids, 'Files with no definitions');
};

window.filterByKind = function(kind) {
    const ids = graphData.nodes
        .filter(n => n.definitions && n.definitions.some(d => d.kind === kind))
        .map(n => n.id);
    highlightNodes(ids, `Files containing ${kind}s`);
};

window.filterByLang = function(lang) {
    const ids = graphData.nodes
        .filter(n => n.lang === lang)
        .map(n => n.id);
    highlightNodes(ids, `${lang} files`);
};

window.filterByFolder = function(folder) {
    const ids = graphData.nodes
        .filter(n => n.folder === folder)
        .map(n => n.id);
    highlightNodes(ids, `${folder}/ files`);
};

window.filterApiSurface = function() {
    const sorted = [...graphData.nodes]
        .sort((a, b) => (adjacencyIn[b.id] || 0) - (adjacencyIn[a.id] || 0))
        .slice(0, 30)
        .map(n => n.id);
    setActiveFilterButton('API surface (high fan-in)');
    highlightNodes(sorted, 'API surface (top fan-in)');
};

window.filterHotPaths = function() {
    const scored = graphData.nodes.map((n) => ({
        id: n.id,
        score: (adjacencyIn[n.id] || 0) + (adjacencyOut[n.id] || 0),
    }));
    const sorted = scored.sort((a, b) => b.score - a.score).slice(0, 30).map(s => s.id);
    setActiveFilterButton('Hot paths (high fan-in/out)');
    highlightNodes(sorted, 'Hot paths (fan-in + fan-out)');
};

window.filterRiskZones = function() {
    const scored = graphData.nodes.map((n) => ({
        id: n.id,
        score: n.lines * (adjacencyIn[n.id] || 0),
    }));
    const sorted = scored.sort((a, b) => b.score - a.score).slice(0, 30).map(s => s.id);
    setActiveFilterButton('Risk zones (large + high fan-in)');
    highlightNodes(sorted, 'Risk zones (size × fan-in)');
};

window.filterEntryPoints = function() {
    const sorted = [...graphData.nodes]
        .sort((a, b) => (adjacencyOut[b.id] || 0) - (adjacencyOut[a.id] || 0))
        .slice(0, 30)
        .map(n => n.id);
    setActiveFilterButton('Entry points (top outbound)');
    highlightNodes(sorted, 'Entry points (top outbound)');
};

function computeCommitAgeDays(dateStr) {
    const parsed = Date.parse(dateStr);
    if (!Number.isFinite(parsed)) {
        throw new Error('Invalid commit date received for churn heatmap');
    }
    const now = Date.now();
    const diffMs = now - parsed;
    return diffMs / (1000 * 60 * 60 * 24);
}

function applyChurnHeatmap() {
    const ages = [];
    for (const node of graphData.nodes) {
        const dateStr = churnByNodeId[node.id];
        if (!dateStr) continue;
        ages.push(computeCommitAgeDays(dateStr));
    }
    if (ages.length === 0) {
        throw new Error('Churn heatmap unavailable — no commit dates fetched');
    }
    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);
    for (const node of graphData.nodes) {
        const mesh = nodeMeshes.get(node.id);
        if (!mesh) continue;
        const dateStr = churnByNodeId[node.id];
        if (!dateStr) {
            mesh.material.color.setHex(0x555555);
            mesh.material.emissiveIntensity = 0.1;
            mesh.scale.setScalar(0.9);
            continue;
        }
        const age = computeCommitAgeDays(dateStr);
        const t = maxAge === minAge ? 0 : (age - minAge) / (maxAge - minAge);
        _tmpColor.setHSL(0.02 + 0.55 * t, 1, 0.55);
        mesh.material.color.copy(_tmpColor);
        mesh.material.emissive.copy(_tmpColor);
        mesh.material.emissiveIntensity = 0.65;
        mesh.scale.setScalar(1.15);
    }
}

window.toggleChurnHeat = async function() {
    if (isChurnLoading) {
        return;
    }
    if (!churnHeatEnabled) {
        if (!graphData || !graphData.meta || !graphData.meta.repo) {
            throw new Error('Repo metadata missing for churn heatmap');
        }
        if (!graphData.meta.provider) {
            throw new Error('Repo provider metadata missing for churn heatmap');
        }
        if (graphData.meta.provider !== 'github') {
            throw new Error('Churn heatmap is currently supported only for GitHub repos');
        }
        if (Object.keys(churnByNodeId).length === 0) {
            isChurnLoading = true;
            const token = getGitHubTokenForApi();
            const files = graphData.nodes.map((node) => ({ path: node.fullPath }));
            churnByNodeId = await fetchCommitDatesForRepo(graphData.meta.repo, token, files, (msg) => {
                const stats = document.getElementById('graphStats');
                if (stats) stats.textContent = msg;
            });
            isChurnLoading = false;
        }
        applyChurnHeatmap();
        churnHeatEnabled = true;
        setActiveFilterButton('Churn heatmap (latest commits)');
        return;
    }
    churnHeatEnabled = false;
    clearFilters();
};

function applyBlameOverlay() {
    const authorColors = {};
    const palette = [0x00ff88, 0xff6b6b, 0x5cc8ff, 0xffd700, 0xff8800, 0xcc88ff, 0x88ffcc];
    let colorIdx = 0;
    for (const node of graphData.nodes) {
        const mesh = nodeMeshes.get(node.id);
        if (!mesh) continue;
        const blame = blameByNodeId[node.fullPath];
        if (!blame) {
            mesh.material.color.setHex(0x333333);
            mesh.material.emissiveIntensity = 0.1;
            continue;
        }
        if (!authorColors[blame.author]) {
            authorColors[blame.author] = palette[colorIdx % palette.length];
            colorIdx++;
        }
        mesh.material.color.setHex(authorColors[blame.author]);
        mesh.material.emissiveIntensity = 0.5;
    }
    const container = document.getElementById('analyticsResults');
    container.innerHTML = '<div style="color:#ff0;margin-bottom:6px;">Last author per file:</div>';
    for (const [author, color] of Object.entries(authorColors)) {
        const hex = '#' + color.toString(16).padStart(6, '0');
        const div = document.createElement('div');
        div.className = 'ap-result';
        div.innerHTML = `<span style="color:${hex};">■</span> ${escapeHtml(author)}`;
        container.appendChild(div);
    }
}

window.toggleBlameOverlay = async function() {
    if (isBlameLoading) {
        return;
    }
    if (blameEnabled) {
        blameEnabled = false;
        clearFilters();
        return;
    }
    if (!graphData || !graphData.meta || !graphData.meta.repo) {
        throw new Error('Repo metadata missing for blame overlay');
    }
    if (!graphData.meta.provider) {
        throw new Error('Repo provider metadata missing for blame overlay');
    }
    if (graphData.meta.provider !== 'github') {
        throw new Error('Blame overlay is currently supported only for GitHub repos');
    }
    if (Object.keys(blameByNodeId).length === 0) {
        isBlameLoading = true;
        const token = getGitHubTokenForApi();
        const files = graphData.nodes.map((node) => ({ path: node.fullPath }));
        blameByNodeId = await fetchBlameForRepo(graphData.meta.repo, token, files, (msg) => {
            const stats = document.getElementById('graphStats');
            if (stats) stats.textContent = msg;
        });
        isBlameLoading = false;
    }
    applyBlameOverlay();
    blameEnabled = true;
    setActiveFilterButton('Blame overlay (last author)');
};

function addLandmark(node) {
    if (!node || !node.id) {
        throw new Error('Cannot add landmark without node');
    }
    if (landmarks.some((lm) => lm.id === node.id)) {
        return;
    }
    landmarks.push({ id: node.id, label: node.label, path: node.fullPath });
    persistLandmarks();
    renderLandmarks();
}

function persistLandmarks() {
    localStorage.setItem('codechat_landmarks', JSON.stringify(landmarks));
}

function hydrateLandmarks() {
    const saved = localStorage.getItem('codechat_landmarks');
    if (!saved) {
        return;
    }
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
        throw new Error('Invalid landmarks data');
    }
    landmarks.length = 0;
    for (const lm of parsed) {
        if (lm && lm.id && lm.label) {
            landmarks.push(lm);
        }
    }
}

function renderLandmarks() {
    const container = document.getElementById('landmarkList');
    if (!container) {
        return;
    }
    container.innerHTML = '';
    for (const lm of landmarks) {
        const div = document.createElement('div');
        div.className = 'ap-result';
        div.textContent = lm.label;
        div.onclick = () => flyToNode(lm.id);
        container.appendChild(div);
    }
}

window.playLandmarkTour = function() {
    if (landmarks.length === 0) {
        throw new Error('No landmarks saved for tour');
    }
    if (landmarkTourTimer) {
        clearInterval(landmarkTourTimer);
        landmarkTourTimer = null;
        return;
    }
    let idx = 0;
    flyToNode(landmarks[idx].id);
    landmarkTourTimer = setInterval(() => {
        idx = (idx + 1) % landmarks.length;
        flyToNode(landmarks[idx].id);
    }, 2400);
};

function buildTourLink() {
    if (landmarks.length === 0) {
        throw new Error('No landmarks to export as tour link');
    }
    const ids = landmarks.map((lm) => lm.id).join(',');
    const url = new URL(window.location.href);
    url.searchParams.set('tour', ids);
    return url.toString();
}

window.exportTourLink = function() {
    const link = buildTourLink();
    navigator.clipboard.writeText(link).then(() => {
        const btn = document.querySelector('[onclick="exportTourLink()"]');
        if (!btn) {
            throw new Error('Tour export button missing');
        }
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 1800);
    });
};

window.showTourQr = function() {
    const link = buildTourLink();
    const modal = document.getElementById('tourQrModal');
    const img = document.getElementById('tourQrImg');
    const anchor = document.getElementById('tourQrLink');
    if (!modal || !img || !anchor) {
        throw new Error('Tour QR modal elements missing');
    }
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(link)}`;
    img.src = qrUrl;
    anchor.href = link;
    anchor.textContent = link;
    modal.style.display = 'block';
    document.exitPointerLock();
};

window.closeTourQr = function() {
    const modal = document.getElementById('tourQrModal');
    if (!modal) {
        throw new Error('Tour QR modal missing');
    }
    modal.style.display = 'none';
};

function importTourFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const tour = params.get('tour');
    if (!tour) {
        return;
    }
    const ids = tour.split(',').filter(Boolean);
    for (const id of ids) {
        const node = graphData.nodes.find((n) => n.id === id);
        if (node) {
            addLandmark(node);
        }
    }
}

function applyFolderCollapse() {
    for (const node of graphData.nodes) {
        const mesh = nodeMeshes.get(node.id);
        if (!mesh) continue;
        const isCollapsed = collapsedFolders.has(node.folder);
        mesh.visible = !isCollapsed;
    }
    for (const line of edgeLines) {
        const fromMesh = nodeMeshes.get(line.userData.from);
        const toMesh = nodeMeshes.get(line.userData.to);
        line.visible = !!(fromMesh && toMesh && fromMesh.visible && toMesh.visible);
    }
}

function buildAnalyticsFilters() {
    const langContainer = document.getElementById('langFilters');
    const folderContainer = document.getElementById('folderFilters');
    if (langContainer.children.length > 0) return;

    const langs = {};
    const folders = {};
    for (const n of graphData.nodes) {
        langs[n.lang] = (langs[n.lang] || 0) + 1;
        folders[n.folder] = (folders[n.folder] || 0) + 1;
    }

    for (const [lang, count] of Object.entries(langs).sort((a, b) => b[1] - a[1])) {
        const btn = document.createElement('button');
        btn.className = 'ap-btn';
        btn.textContent = `${lang} (${count})`;
        btn.onclick = () => filterByLang(lang);
        langContainer.appendChild(btn);
    }

    for (const [folder, count] of Object.entries(folders).sort((a, b) => b[1] - a[1])) {
        const btn = document.createElement('button');
        btn.className = 'ap-btn';
        btn.textContent = `${folder}/ (${count})`;
        btn.onclick = () => {
            if (collapsedFolders.has(folder)) {
                collapsedFolders.delete(folder);
                btn.style.textDecoration = '';
                btn.style.color = '';
            } else {
                collapsedFolders.add(folder);
                btn.style.textDecoration = 'line-through';
                btn.style.color = '#555';
            }
            applyFolderCollapse();
        };
        folderContainer.appendChild(btn);
    }
}

// ============================================================
// ANIMATE (fixed node bobbing - no drift)
// ============================================================
let frameCount = 0;

function animate() {
    requestAnimationFrame(animate);
    frameCount++;

    if (gameStarted && pageVisible) {
        updateMovement();
        updateFlyTarget();
        updateHover();
        if (frameCount % 2 === 0) updateMinimap();
        updateFunctionOrbits();

        // Node bobbing using baseY (no drift)
        const time = Date.now() * 0.001;
        let hasLayoutTransition = false;
        for (const [id, mesh] of nodeMeshes) {
            if (mesh.userData.targetPos) {
                hasLayoutTransition = true;
                mesh.position.lerp(mesh.userData.targetPos, 0.08);
                if (mesh.position.distanceTo(mesh.userData.targetPos) < 0.05) {
                    mesh.position.copy(mesh.userData.targetPos);
                    delete mesh.userData.targetPos;
                }
            } else {
                mesh.position.y = mesh.userData.baseY + Math.sin(time + mesh.position.x * 0.1) * 0.3;
            }
        }
        if (hasLayoutTransition) {
            rebuildEdges();
        }

        // Send position every 3 frames
        if (frameCount % 3 === 0) {
            sendPositionUpdate();
        }
    }

    renderer.render(scene, camera);
}

// ============================================================
// SEARCH (Ctrl+K)
// ============================================================
let searchIndex = [];

function buildSearchIndex() {
    searchIndex = [];
    for (const node of graphData.nodes) {
        searchIndex.push({ type: 'file', name: node.label, path: node.fullPath, nodeId: node.id });
        if (node.definitions) {
            for (const def of node.definitions) {
                searchIndex.push({ type: def.kind, name: def.name, path: node.fullPath, nodeId: node.id, line: def.line });
            }
        }
    }
}

function openSearch() {
    const overlay = document.getElementById('searchOverlay');
    const input = document.getElementById('searchInput');
    overlay.style.display = 'block';
    input.value = '';
    input.focus();
    document.exitPointerLock();
    document.getElementById('searchResults').innerHTML = '';
}

function closeSearch() {
    document.getElementById('searchOverlay').style.display = 'none';
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
}

function updateFlyTarget() {
    if (!flyTarget.active) {
        return;
    }
    flyTarget.progress += 1;
    const t = flyTarget.progress / flyTarget.durationFrames;
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    playerGroup.position.lerpVectors(flyTarget.from, flyTarget.to, Math.min(eased, 1));
    if (flyTarget.progress >= flyTarget.durationFrames) {
        flyTarget.active = false;
    }
}

window.showBlastRadius = function() {
    if (!selectedNodeId) {
        throw new Error('Select a node first (click it) to see blast radius');
    }
    const transitiveImpact = new Set();
    const queue = [selectedNodeId];
    const visited = new Set([selectedNodeId]);
    let depth = 0;
    while (queue.length > 0 && depth < 3) {
        const next = [];
        for (const id of queue) {
            for (const dep of (adjacencyInList[id] || [])) {
                if (!visited.has(dep)) {
                    visited.add(dep);
                    transitiveImpact.add(dep);
                    next.push(dep);
                }
            }
        }
        queue.length = 0;
        queue.push(...next);
        depth++;
    }
    const impacted = Array.from(transitiveImpact);
    highlightNodes(impacted, `Blast radius of ${selectedNodeId}`);
    setActiveFilterButton('Blast radius (selected node)');
    const container = document.getElementById('analyticsResults');
    const header = document.createElement('div');
    header.style.cssText = 'color:#ff0;margin-bottom:4px;';
    header.textContent = `If you change this file, ${impacted.length} files are impacted:`;
    container.insertBefore(header, container.firstChild);
};

function openInEditor(editor, node, line) {
    if (!node.fullPath) {
        throw new Error('Node has no fullPath for IDE open');
    }
    const lineNumber = line || 1;
    const url = editor.scheme
        .replace('{path}', encodeURIComponent(node.fullPath))
        .replace('{line}', lineNumber);
    window.open(url, '_blank');
    closeIdePicker();
}

function openIdePicker(node, line) {
    if (!node) {
        throw new Error('openIdePicker requires a node');
    }
    const modal = document.getElementById('idePickerModal');
    const pathEl = document.getElementById('idePickerPath');
    const btnsEl = document.getElementById('idePickerButtons');
    if (!modal || !pathEl || !btnsEl) {
        throw new Error('IDE picker modal elements missing');
    }
    const lineNumber = line || 1;
    const isRemote = !!(graphData && graphData.meta && graphData.meta.provider && graphData.meta.provider !== 'local');
    pathEl.textContent = node.fullPath + `:${lineNumber}`;
    btnsEl.innerHTML = '';

    if (isRemote) {
        const repoMeta = graphData.meta;
        let remoteUrl = null;
        if (repoMeta.provider === 'github' && repoMeta.repo && repoMeta.branch) {
            remoteUrl = `https://github.com/${repoMeta.repo}/blob/${repoMeta.branch}/${node.fullPath}#L${lineNumber}`;
        } else if (repoMeta.provider === 'gitlab' && repoMeta.repo && repoMeta.branch) {
            remoteUrl = `https://gitlab.com/${repoMeta.repo}/-/blob/${repoMeta.branch}/${node.fullPath}#L${lineNumber}`;
        }

        if (remoteUrl) {
            const viewBtn = document.createElement('button');
            viewBtn.className = 'ide-btn';
            viewBtn.innerHTML = `<span class="ide-icon">🌐</span> View on ${repoMeta.provider === 'github' ? 'GitHub' : 'GitLab'}`;
            viewBtn.onclick = () => { window.open(remoteUrl, '_blank'); closeIdePicker(); };
            btnsEl.appendChild(viewBtn);
        }

        const copyBtn = document.createElement('button');
        copyBtn.className = 'ide-btn';
        copyBtn.innerHTML = `<span class="ide-icon">📋</span> Copy file path`;
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(node.fullPath);
            copyBtn.innerHTML = `<span class="ide-icon">✅</span> Copied!`;
            setTimeout(() => closeIdePicker(), 1200);
        };
        btnsEl.appendChild(copyBtn);

        const noteEl = document.createElement('div');
        noteEl.style.cssText = 'color:#555;font-size:10px;margin-top:10px;line-height:1.5;';
        noteEl.textContent = 'To open in your local IDE, clone the repo first.';
        btnsEl.appendChild(noteEl);
    } else {
        for (const editor of IDE_EDITORS) {
            const btn = document.createElement('button');
            btn.className = 'ide-btn';
            btn.innerHTML = `<span class="ide-icon">${editor.icon}</span> ${editor.label}`;
            btn.onclick = () => openInEditor(editor, node, lineNumber);
            btnsEl.appendChild(btn);
        }
    }
    modal.style.display = 'block';
    document.exitPointerLock();
}

window.openIdePickerFromHover = function() {
    if (!hoveredNode) {
        throw new Error('Hover a node before opening IDE picker');
    }
    openIdePicker(hoveredNode, null);
};

window.closeIdePicker = function() {
    const modal = document.getElementById('idePickerModal');
    if (!modal) {
        throw new Error('IDE picker modal missing');
    }
    modal.style.display = 'none';
};

function openFolderSettings() {
    if (!gameStarted) {
        throw new Error('openFolderSettings: game not started');
    }
    if (!graphData) {
        throw new Error('openFolderSettings: no graph data loaded');
    }

    const panel = document.getElementById('folderSettingsPanel');
    const list = document.getElementById('folderSettingsList');
    if (!panel || !list) {
        throw new Error('Folder settings panel elements missing from DOM');
    }

    const folders = [...new Set(graphData.nodes.map((n) => n.folder))].sort();
    list.innerHTML = '';

    for (const folder of folders) {
        const prefs = getFolderPrefs(folder);
        const defaultColorHex = '#' + getFolderColor(folder).toString(16).padStart(6, '0');
        const nodeCount = graphData.nodes.filter((n) => n.folder === folder).length;

        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:10px; margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid #111;';

        const nameEl = document.createElement('span');
        nameEl.style.cssText = 'color:#ccc; font-size:12px; width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex-shrink:0;';
        nameEl.textContent = `${folder} (${nodeCount})`;
        nameEl.title = folder;

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = prefs.color || defaultColorHex;
        colorInput.style.cssText = 'width:32px; height:26px; border:none; cursor:pointer; border-radius:4px; flex-shrink:0;';
        colorInput.title = 'Change folder color';
        colorInput.oninput = () => setFolderColor(folder, colorInput.value);

        const shapeSelect = document.createElement('select');
        shapeSelect.style.cssText = 'background:#111; color:#ccc; border:1px solid #333; border-radius:4px; padding:3px 6px; font-family:Courier New,monospace; font-size:11px; flex-shrink:0;';
        shapeSelect.title = 'Change node shape';
        for (const shape of ['sphere', 'cube', 'diamond', 'cylinder']) {
            const opt = document.createElement('option');
            opt.value = shape;
            opt.textContent = shape;
            if ((prefs.shape || 'sphere') === shape) opt.selected = true;
            shapeSelect.appendChild(opt);
        }
        shapeSelect.onchange = () => setFolderShape(folder, shapeSelect.value);

        const toggleBtn = document.createElement('button');
        const isCollapsed = collapsedFolders.has(folder);
        toggleBtn.textContent = isCollapsed ? 'Show' : 'Hide';
        toggleBtn.style.cssText = 'padding:3px 10px; background:transparent; color:#888; border:1px solid #444; border-radius:4px; cursor:pointer; font-family:Courier New,monospace; font-size:10px; flex-shrink:0;';
        toggleBtn.onclick = () => {
            toggleFolderCollapse(folder);
            toggleBtn.textContent = collapsedFolders.has(folder) ? 'Show' : 'Hide';
        };

        row.appendChild(nameEl);
        row.appendChild(colorInput);
        row.appendChild(shapeSelect);
        row.appendChild(toggleBtn);
        list.appendChild(row);
    }

    panel.style.display = 'block';
    document.exitPointerLock();
}

window.closeFolderSettings = function() {
    const panel = document.getElementById('folderSettingsPanel');
    if (!panel) {
        throw new Error('folderSettingsPanel element missing from DOM');
    }
    panel.style.display = 'none';
};

window.loadLocalFolder = async function() {
    if (!window.showDirectoryPicker) {
        showLoadError('Your browser does not support local folder loading (File System Access API)');
        return;
    }

    const nicknameInput = document.getElementById('nicknameInput');
    if (nicknameInput && nicknameInput.value.trim()) {
        myNickname = nicknameInput.value.trim();
    }

    const localBtn = document.getElementById('localFolderBtn');
    const statusEl = document.getElementById('localFolderStatus');
    if (!localBtn) {
        throw new Error('localFolderBtn element missing from DOM');
    }
    if (!statusEl) {
        throw new Error('localFolderStatus element missing from DOM');
    }

    localBtn.disabled = true;
    statusEl.style.display = 'block';
    statusEl.textContent = 'Opening folder picker...';
    hideLoadError();

    try {
        const directoryHandle = await window.showDirectoryPicker({ mode: 'read' });
        statusEl.textContent = `Selected: ${directoryHandle.name}. Scanning...`;
        const data = await generateGraphFromLocalFolder(directoryHandle, (msg) => {
            statusEl.textContent = msg;
        });
        if (!data || !data.nodes || !data.edges) {
            throw new Error('Local folder graph generation returned no data');
        }

        graphData = data;
        saveRecentRepo(`local:${directoryHandle.name}`);
        init();

        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('crosshair').style.display = 'block';
        document.getElementById('hud').style.display = 'block';
        document.getElementById('legend').style.display = 'block';
        document.getElementById('minimap').style.display = 'block';
        document.getElementById('chatBox').style.display = 'block';

        gameStarted = true;
        renderer.domElement.requestPointerLock();
        connectMultiplayer();
        buildSearchIndex();
        if (graphData.meta) showLimitations(graphData.meta);
    } catch (err) {
        showLoadError(err.message);
        localBtn.disabled = false;
        statusEl.textContent = '';
        statusEl.style.display = 'none';
    }
};

function performSearch(query) {
    const results = document.getElementById('searchResults');
    results.innerHTML = '';
    if (!query || query.length < 2) return;

    if (query.trim().startsWith('?')) {
        const intentQuery = query.trim().slice(1).trim();
        if (intentQuery.length < 2) return;
        const target = resolveIntentTarget(intentQuery);
        if (!target) {
            results.innerHTML = '<div class="search-result" style="color:#666;">No intent match. Try auth, payments, onboarding, notifications, api, data.</div>';
            return;
        }
        const div = document.createElement('div');
        div.className = 'search-result';
        div.textContent = `Jump to: ${target.label}`;
        div.onclick = () => {
            flyToNode(target.id);
            closeSearch();
        };
        results.appendChild(div);
        return;
    }

    const q = query.toLowerCase();
    const matches = searchIndex
        .filter(item => item.name.toLowerCase().includes(q) || item.path.toLowerCase().includes(q))
        .slice(0, 30);

    for (const match of matches) {
        const div = document.createElement('div');
        div.className = 'search-result';
        const kindLabel = match.type === 'file' ? 'FILE' : match.type === 'function' ? 'FN' : match.type === 'class' ? 'CLS' : 'VAR';
        const lineInfo = match.line ? `:${match.line}` : '';
        div.innerHTML = `<span class="sr-kind">[${kindLabel}]</span> ${escapeHtml(match.name)} <span class="sr-file">${escapeHtml(match.path)}${lineInfo}</span>`;
        div.onclick = () => {
            flyToNode(match.nodeId);
            closeSearch();
        };
        results.appendChild(div);
    }
}

function resolveIntentTarget(intentQuery) {
    const tokens = intentQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const expandedTokens = new Set(tokens);
    for (const t of tokens) {
        if (intentLexicon[t]) {
            intentLexicon[t].forEach((alt) => expandedTokens.add(alt));
        }
    }
    let best = null;
    let bestScore = 0;
    for (const node of graphData.nodes) {
        let score = 0;
        const haystack = `${node.label} ${node.fullPath}`.toLowerCase();
        for (const token of expandedTokens) {
            if (haystack.includes(token)) {
                score += 2;
            }
        }
        if (node.definitions) {
            for (const def of node.definitions) {
                const name = def.name.toLowerCase();
                for (const token of expandedTokens) {
                    if (name.includes(token)) score += 1;
                }
            }
        }
        if (score > bestScore) {
            bestScore = score;
            best = node;
        }
    }
    return bestScore > 0 ? best : null;
}

// ============================================================
// LOAD & START
// ============================================================
window.loadAndStart = async function() {
    const repoInput = document.getElementById('repoInput');
    const url = repoInput.value.trim();
    if (!url) {
        showLoadError('Enter a repo URL (GitHub or GitLab)');
        return;
    }

    const provider = url.includes('github.com/') ? 'github'
        : (url.includes('gitlab.com/') ? 'gitlab' : null);
    if (!provider) {
        showLoadError('Only GitHub and GitLab URLs are supported');
        return;
    }

    const nicknameInput = document.getElementById('nicknameInput');
    if (nicknameInput && nicknameInput.value.trim()) {
        myNickname = nicknameInput.value.trim();
    }

    const btn = document.getElementById('startBtn');
    btn.disabled = true;
    btn.textContent = 'LOADING...';
    showLoading(true);
    hideLoadError();

    try {
        let data = null;
        if (provider === 'github') {
            const token = getGitHubTokenForApi();
            data = await generateGraphFromGitHub(url, token, (msg) => {
                btn.textContent = msg;
            });
        }
        if (provider === 'gitlab') {
            const token = getGitLabTokenForApi();
            if (!token) {
                throw new Error('GitLab private repos require login (Login with GitLab)');
            }
            data = await generateGraphFromGitLab(url, token, (msg) => {
                btn.textContent = msg;
            });
        }

        if (!data) {
            throw new Error('Graph generation returned no data');
        }

        if (!data.nodes || !data.edges) {
            throw new Error('Invalid graph data returned');
        }

        graphData = data;
        saveRecentRepo(url);

        init();

        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('crosshair').style.display = 'block';
        document.getElementById('hud').style.display = 'block';
        document.getElementById('legend').style.display = 'block';
        document.getElementById('minimap').style.display = 'block';
        document.getElementById('chatBox').style.display = 'block';

        gameStarted = true;
        renderer.domElement.requestPointerLock();
        connectMultiplayer();
        buildSearchIndex();
        if (graphData.meta) showLimitations(graphData.meta);
    } catch (err) {
        showLoadError(err.message);
        btn.disabled = false;
        btn.textContent = 'EXPLORE';
        showLoading(false);
    }
};

function showLoading(on) {
    const bar = document.getElementById('loadingBar');
    const fill = bar.querySelector('.fill');
    if (on) {
        bar.style.display = 'block';
        fill.style.width = '0%';
        let pct = 0;
        const interval = setInterval(() => {
            pct += Math.random() * 15;
            if (pct > 90) pct = 90;
            fill.style.width = pct + '%';
            if (!bar.dataset.active) {
                clearInterval(interval);
                fill.style.width = '100%';
            }
        }, 300);
        bar.dataset.active = '1';
    } else {
        delete bar.dataset.active;
        bar.style.display = 'none';
    }
}

function showLoadError(msg) {
    const el = document.getElementById('loadError');
    el.textContent = msg;
    el.style.display = 'block';
}

function hideLoadError() {
    document.getElementById('loadError').style.display = 'none';
}

function saveRecentRepo(url) {
    if (url.startsWith('local:')) {
        return;
    }
    const recent = JSON.parse(localStorage.getItem('codechat_recent') || '[]');
    const filtered = recent.filter(r => r !== url);
    filtered.unshift(url);
    localStorage.setItem('codechat_recent', JSON.stringify(filtered.slice(0, 5)));
}

function loadRecentRepos() {
    const recent = JSON.parse(localStorage.getItem('codechat_recent') || '[]');
    const container = document.getElementById('recentRepos');
    container.innerHTML = '';
    for (const url of recent) {
        if (url.startsWith('local:')) {
            continue;
        }
        const div = document.createElement('div');
        div.className = 'recent-repo';
        div.textContent = url;
        div.onclick = () => {
            document.getElementById('repoInput').value = url;
            document.getElementById('startBtn').disabled = false;
        };
        container.appendChild(div);
    }
}

// ============================================================
// LIMITATIONS & CONTACT
// ============================================================
function showLimitations(meta) {
    const unsupported = Array.isArray(meta.unsupportedExtensions) ? meta.unsupportedExtensions : [];
    const parseSummary = meta.parseSummary || {};
    const totalFiles = Number(meta.totalFiles || 0);
    const partialCount = Number(parseSummary.partial || 0);
    const unsupportedCount = Number(parseSummary.unsupported || 0);
    const totalLimited = partialCount + unsupportedCount;
    if (unsupported.length === 0 && totalLimited === 0) return;

    const banner = document.getElementById('limitationsBanner');
    const extsEl = document.getElementById('lbExts');
    const titleEl = banner.querySelector('.lb-title');
    if (titleEl) {
        titleEl.textContent = totalFiles > 0
            ? `Parser Coverage: ${Math.max(0, totalFiles - unsupportedCount)}/${totalFiles}`
            : 'Parser Coverage';
    }
    const extText = unsupported.length > 0 ? `Unsupported extensions: ${unsupported.join(', ')}` : 'No unknown extensions detected';
    extsEl.textContent = `${extText} · Partial: ${partialCount} · Unsupported files: ${unsupportedCount}`;
    banner.style.display = 'block';

    const contactBtn = document.getElementById('contactBtn');
    contactBtn.style.display = unsupported.length > 0 ? 'block' : 'none';

    const textarea = document.getElementById('contactMessage');
    const repoUrl = document.getElementById('repoInput').value.trim();
    textarea.value = `Hi! I'd love CodeFly to support these file types:\n\n${unsupported.join(', ')}\n\nParse summary: partial=${partialCount}, unsupported=${unsupportedCount}\nRepo: ${repoUrl}\n\nThanks!`;
}

window.openContactModal = function() {
    document.getElementById('contactModal').style.display = 'block';
    document.exitPointerLock();
};

window.closeContactModal = function() {
    document.getElementById('contactModal').style.display = 'none';
};

window.sendContactMessage = function() {
    const message = document.getElementById('contactMessage').value.trim();
    if (!message) return;

    const subject = encodeURIComponent('CodeFly Language Support Request');
    const body = encodeURIComponent(message);
    window.open(`mailto:codefly@example.com?subject=${subject}&body=${body}`, '_blank');

    const modal = document.getElementById('contactModal');
    modal.innerHTML = '<div class="cm-sent">Opening email client...</div>';
    setTimeout(() => { modal.style.display = 'none'; }, 2000);
};

// Chat input handler
window.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                const text = chatInput.value.trim();
                if (text) {
                    sendChat(text);
                    chatInput.value = '';
                }
                chatInput.style.display = 'none';
                renderer.domElement.requestPointerLock();
            }
            if (e.key === 'Escape') {
                chatInput.style.display = 'none';
                renderer.domElement.requestPointerLock();
            }
        });
    }

    // Search input handler
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            performSearch(e.target.value);
        });
        searchInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Escape') {
                closeSearch();
            }
        });
    }

    // Repo input — enable button when text entered
    const repoInput = document.getElementById('repoInput');
    if (repoInput) {
        repoInput.addEventListener('input', () => {
            document.getElementById('startBtn').disabled = !repoInput.value.trim();
        });
        repoInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && repoInput.value.trim()) {
                loadAndStart();
            }
        });
    }

    loadAuthState();
    updateAuthUi();
    completeGitLabOAuthFromUrl().catch((err) => {
        const msg = err && err.message ? err.message : 'GitLab OAuth failed';
        const status = document.getElementById('authStatus');
        if (status) {
            status.textContent = msg;
        }
        const loadError = document.getElementById('loadError');
        if (loadError) {
            loadError.textContent = msg;
            loadError.style.display = 'block';
        }
    });

    loadRecentRepos();
});
