// ============================================================
// SUGARSPACE CODE EXPLORER - 3D First-Person Codebase Flythrough
// With multiplayer + function expansion
// ============================================================

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function assertGraphArrayField(graph, fieldName, context) {
    if (!Array.isArray(graph[fieldName])) {
        throw new Error(`${context} graph contract violation: ${fieldName} must be an array`);
    }
}

function assertGraphDataContract(data, context) {
    if (!data || typeof data !== 'object') {
        throw new Error(`${context} graph contract violation: graph payload missing`);
    }
    assertGraphArrayField(data, 'nodes', context);
    assertGraphArrayField(data, 'edges', context);
    if (!Object.prototype.hasOwnProperty.call(data, 'symbolEdges')) {
        throw new Error(`${context} graph contract violation: symbolEdges is required`);
    }
    assertGraphArrayField(data, 'symbolEdges', context);
    if (!data.meta || typeof data.meta !== 'object') {
        throw new Error(`${context} graph contract violation: meta must be an object`);
    }
}

let graphData = null;
let currentRepoUrl = null;
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
let hoveredEdgeLine = null;
let selectedNodeId = null;
let focusEdgesEnabled = false;
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

// Code agents
const agentMeshes = new Map();
const agents = new Map();

// 3D Code Board
let codeBoardMesh = null;
let codeBoardCanvas = null;
let codeBoardCtx = null;
let codeBoardTexture = null;
let codeBoardBackCanvas = null;
let codeBoardBackCtx = null;
let codeBoardBackTexture = null;
let codeBoardScrollOffset = 0;
let codeBoardTargetLine = 0;
const UI_PARSE_STATUS_FULL = 'full';
const UI_PARSE_STATUS_PARTIAL = 'partial';
const UI_PARSE_STATUS_UNSUPPORTED = 'unsupported';
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
let pathSearchIndex = [];
let selectedPathEdgeKey = null;
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
        return UI_PARSE_STATUS_FULL;
    }
    return node.parseStatus;
}

function getParseStatusMeta(status) {
    if (status === UI_PARSE_STATUS_UNSUPPORTED) {
        return { label: 'UNSUPPORTED', color: '#bbbbbb', accent: 0x9a9a9a };
    }
    if (status === UI_PARSE_STATUS_PARTIAL) {
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
const OAUTH_PENDING_KEY = 'codechat_oauth_pending_v1';
const RECENT_REPOS_STORAGE_KEY = 'codechat_recent';
let authState = { provider: null, token: null, userLabel: null };
let githubDeviceFlow = { deviceCode: null, userCode: null, verificationUri: null, intervalSec: null, expiresInSec: null };

function setPendingOAuth(provider, state) {
    const payload = JSON.stringify({ provider, state, createdAt: Date.now() });
    sessionStorage.setItem(OAUTH_PENDING_KEY, payload);
    localStorage.setItem(OAUTH_PENDING_KEY, payload);
}

function getPendingOAuth() {
    const raw = sessionStorage.getItem(OAUTH_PENDING_KEY) || localStorage.getItem(OAUTH_PENDING_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.provider || !parsed.state) {
            return null;
        }
        const createdAt = Number(parsed.createdAt || 0);
        if (!Number.isFinite(createdAt) || createdAt <= 0 || (Date.now() - createdAt) > 10 * 60 * 1000) {
            clearPendingOAuth();
            return null;
        }
        return parsed;
    } catch {
        clearPendingOAuth();
        return null;
    }
}

function clearPendingOAuth() {
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
    localStorage.removeItem(OAUTH_PENDING_KEY);
}

function clearLegacyOAuthState() {
    sessionStorage.removeItem('github_oauth_state');
    localStorage.removeItem('github_oauth_state');
    sessionStorage.removeItem('gitlab_oauth_state');
    localStorage.removeItem('gitlab_oauth_state');
}

function cleanOAuthUrl() {
    window.history.replaceState({}, '', window.location.pathname);
}

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
    const status = document.getElementById('authStatus');
    const logoutBtn = document.getElementById('logoutBtn');
    const authBlock = document.getElementById('authBlock');
    const repoBrowser = document.getElementById('repoBrowser');
    const repoInputSection = document.getElementById('publicRepoSection');
    const localFolderSection = document.getElementById('localFolderSection');
    const privateRepoSection = document.getElementById('privateAuthSection');
    const startBtn = document.getElementById('startBtn');
    const loadingBar = document.getElementById('loadingBar');
    const graphStats = document.getElementById('graphStats');
    const recentRepos = document.getElementById('recentRepos');
    const controlsHint = document.querySelector('.controls-hint');
    
    if (!status || !logoutBtn || !authBlock || !repoBrowser) return;

    if (authState.provider && authState.token) {
        status.textContent = `Connected as ${authState.userLabel}`;
        status.className = 'logged-in';
        logoutBtn.style.display = 'inline-block';
        
        // Show repository browser for GitHub and GitLab
        if (authState.provider === 'github' || authState.provider === 'gitlab') {
            authBlock.style.display = 'none';
            repoBrowser.style.display = 'block';
            
            // Hide irrelevant sections when authenticated
            if (repoInputSection) repoInputSection.style.display = 'none';
            if (localFolderSection) localFolderSection.style.display = 'none';
            if (privateRepoSection) privateRepoSection.style.display = 'none';
            if (startBtn) startBtn.style.display = 'none';
            if (loadingBar) loadingBar.style.display = 'none';
            if (graphStats) graphStats.style.display = 'none';
            if (recentRepos) recentRepos.style.display = 'none';
            if (controlsHint) controlsHint.style.display = 'none';
        }
    } else {
        status.textContent = 'Not connected';
        status.className = 'logged-out';
        logoutBtn.style.display = 'none';
        authBlock.style.display = 'block';
        repoBrowser.style.display = 'none';
        
        // Show all sections when not authenticated
        if (repoInputSection) repoInputSection.style.display = 'block';
        if (localFolderSection) localFolderSection.style.display = 'block';
        if (privateRepoSection) privateRepoSection.style.display = 'block';
        if (startBtn) startBtn.style.display = 'inline-block';
        if (recentRepos) recentRepos.style.display = 'block';
        if (controlsHint) controlsHint.style.display = 'block';
    }
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

    clearPendingOAuth();
    clearLegacyOAuthState();

    // Clear repository data
    allRepos = [];
    filteredRepos = [];
    currentPage = 1;

    // Reset UI
    const repoList = document.getElementById('repoList');
    if (repoList) {
        repoList.innerHTML = '<div style="padding:40px; text-align:center; color:#8b949e;">Connect an account to load repositories.</div>';
    }
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
        clearPendingOAuth();
        clearLegacyOAuthState();
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

async function readJsonFetchResponse(response, context) {
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`${context} returned a non-JSON response`);
    }
    if (!response.ok) {
        throw new Error(getOAuthResponseError(data, context, response.status));
    }
    return data;
}

function getOAuthResponseError(data, context, status) {
    if (!data) {
        return `${context} failed: ${status}`;
    }
    if (data.error_description) {
        return data.error_description;
    }
    if (data.error) {
        return data.error;
    }
    return `${context} failed: ${status}`;
}

window.loginGitHub = async function() {
    const cfg = getOAuthConfig();
    const clientId = cfg.githubClientId;

    if (!clientId) {
        openPatModal('github');
        return;
    }

    // Use regular OAuth redirect flow
    const state = Math.random().toString(36).substring(7);
    const redirectUri = window.location.origin + window.location.pathname;
    
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'repo');
    url.searchParams.set('state', state);
    
    clearPendingOAuth();
    clearLegacyOAuthState();
    setPendingOAuth('github', state);
    
    // Redirect to GitHub
    window.location.href = url.toString();
};

window.loginGitLab = async function() {
    const cfg = getOAuthConfig();

    if (!cfg.gitlabClientId) {
        openPatModal('gitlab');
        return;
    }

    // Use regular OAuth redirect flow
    const state = Math.random().toString(36).substring(7);
    const redirectUri = window.location.origin + window.location.pathname;
    
    const url = new URL('https://gitlab.com/oauth/authorize');
    url.searchParams.set('client_id', cfg.gitlabClientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'read_api');
    url.searchParams.set('state', state);
    
    clearPendingOAuth();
    clearLegacyOAuthState();
    setPendingOAuth('gitlab', state);
    
    // Redirect to GitLab
    window.location.href = url.toString();
};

async function completeGitHubOAuthFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (!error && !code && !state) {
        return;
    }

    const pending = getPendingOAuth();
    if (!pending || pending.provider !== 'github') {
        return;
    }

    if (error) {
        clearPendingOAuth();
        clearLegacyOAuthState();
        alert('GitHub authorization failed: ' + error);
        cleanOAuthUrl();
        return;
    }

    if (!code || !state) {
        return;
    }

    if (state !== pending.state) {
        clearPendingOAuth();
        clearLegacyOAuthState();
        alert('GitHub OAuth session expired. Please connect again.');
        cleanOAuthUrl();
        return;
    }

    clearPendingOAuth();
    clearLegacyOAuthState();
    
    const proxyHost = window.CODEFLY_MULTIPLAYER_HOST || '';
    const baseUrl = proxyHost ? proxyHost : '';
    
    try {
        // Exchange code for token
        const tokenRes = await fetch(`${baseUrl}/github/oauth/authorize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code, state }),
        });
        
        const tokenData = await readJsonFetchResponse(tokenRes, 'GitHub token exchange');
        if (tokenData.error) {
            throw new Error(getOAuthResponseError(tokenData, 'GitHub token exchange', tokenRes.status));
        }
        
        if (!tokenData.access_token) {
            throw new Error('No access token received');
        }
        
        // Get user info
        const userRes = await fetch(`${baseUrl}/github/oauth/user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ access_token: tokenData.access_token }),
        });
        
        const userData = await readJsonFetchResponse(userRes, 'GitHub user fetch');
        
        // Save auth state
        authState = { 
            provider: 'github', 
            token: tokenData.access_token, 
            userLabel: userData.login 
        };
        saveAuthState();
        
        // Clean URL
        cleanOAuthUrl();
        
        // Update UI
        updateAuthUi();
        // Load user's repositories
        if (authState.provider === 'github') {
            loadGitHubUser();
            loadGitHubRepos();
        }
        
    } catch (err) {
        clearPendingOAuth();
        alert('GitHub login failed: ' + err.message);
        cleanOAuthUrl();
    }
}

async function completeGitLabOAuthFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (!error && !code && !state) {
        return;
    }

    const pending = getPendingOAuth();
    if (!pending || pending.provider !== 'gitlab') {
        return;
    }

    if (error) {
        clearPendingOAuth();
        clearLegacyOAuthState();
        alert('GitLab authorization failed: ' + error);
        cleanOAuthUrl();
        return;
    }

    if (!code || !state) {
        return;
    }

    if (state !== pending.state) {
        clearPendingOAuth();
        clearLegacyOAuthState();
        alert('GitLab OAuth session expired. Please connect again.');
        cleanOAuthUrl();
        return;
    }

    clearPendingOAuth();
    clearLegacyOAuthState();
    
    const proxyHost = window.CODEFLY_MULTIPLAYER_HOST || '';
    const baseUrl = proxyHost ? proxyHost : '';
    
    try {
        // Exchange code for token
        const tokenRes = await fetch(`${baseUrl}/gitlab/oauth/authorize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code, state }),
        });
        
        const tokenData = await readJsonFetchResponse(tokenRes, 'GitLab token exchange');
        if (tokenData.error) {
            throw new Error(getOAuthResponseError(tokenData, 'GitLab token exchange', tokenRes.status));
        }
        
        if (!tokenData.access_token) {
            throw new Error('No access token received');
        }
        
        // Get user info
        const userRes = await fetch(`${baseUrl}/gitlab/oauth/user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ access_token: tokenData.access_token }),
        });
        
        const userData = await readJsonFetchResponse(userRes, 'GitLab user fetch');
        
        // Save auth state
        authState = { 
            provider: 'gitlab', 
            token: tokenData.access_token, 
            userLabel: userData.username 
        };
        saveAuthState();
        
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
        
        // Update UI
        updateAuthUi();
        // Load user's repositories
        if (authState.provider === 'gitlab') {
            loadGitLabUser();
            loadGitLabRepos();
        }
        
    } catch (err) {
        clearPendingOAuth();
        alert('GitLab login failed: ' + err.message);
        cleanOAuthUrl();
    }
}

async function completeOAuthFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    if (!code && !state && !error) return;

    const pending = getPendingOAuth();
    if (!pending) {
        cleanOAuthUrl();
        return;
    }
    if (pending.provider === 'github') {
        await completeGitHubOAuthFromUrl();
        return;
    }
    if (pending.provider === 'gitlab') {
        await completeGitLabOAuthFromUrl();
        return;
    }
    clearPendingOAuth();
}

function loadConnectedProviderData() {
    if (authState.provider === 'github' && authState.token) {
        loadGitHubUser();
        loadGitHubRepos();
    } else if (authState.provider === 'gitlab' && authState.token) {
        loadGitLabUser();
        loadGitLabRepos();
    }
}

// GitHub Repository Browser
let allRepos = [];
let filteredRepos = [];
let currentPage = 1;
const reposPerPage = 30;

async function loadGitHubUser() {
    const proxyHost = window.CODEFLY_MULTIPLAYER_HOST || '';
    const baseUrl = proxyHost ? proxyHost : '';
    
    try {
        const response = await fetch(`${baseUrl}/github/oauth/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: authState.token }),
        });
        
        if (!response.ok) throw new Error('Failed to load user');
        const user = await response.json();
        
        // Update UI with user info
        document.getElementById('userAvatar').src = user.avatar_url;
        document.getElementById('userName').textContent = user.name || user.login;
        document.getElementById('userLogin').textContent = '@' + user.login;
        
        // Set provider badge
        const badge = document.getElementById('providerBadge');
        badge.textContent = '🐙 GitHub';
        badge.style.background = '#238636';
        badge.style.color = '#fff';
    } catch (err) {
        console.error('Failed to load user:', err);
    }
}

async function loadGitLabUser() {
    const proxyHost = window.CODEFLY_MULTIPLAYER_HOST || '';
    const baseUrl = proxyHost ? proxyHost : '';
    
    try {
        const response = await fetch(`${baseUrl}/gitlab/oauth/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: authState.token }),
        });
        
        if (!response.ok) throw new Error('Failed to load user');
        const user = await response.json();
        
        // Update UI with user info
        document.getElementById('userAvatar').src = user.avatar_url;
        document.getElementById('userName').textContent = user.name || user.username;
        document.getElementById('userLogin').textContent = '@' + user.username;
        
        // Set provider badge
        const badge = document.getElementById('providerBadge');
        badge.textContent = '🦊 GitLab';
        badge.style.background = '#fc6d26';
        badge.style.color = '#fff';
    } catch (err) {
        console.error('Failed to load user:', err);
    }
}

async function loadGitHubRepos(page = 1) {
    const proxyHost = window.CODEFLY_MULTIPLAYER_HOST || '';
    const baseUrl = proxyHost ? proxyHost : '';
    
    try {
        const response = await fetch(`https://api.github.com/user/repos?per_page=${reposPerPage}&page=${page}&sort=updated&type=all`, {
            headers: {
                'Authorization': `Bearer ${authState.token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });
        
        if (!response.ok) throw new Error('Failed to load repositories');
        const repos = await response.json();
        
        if (page === 1) {
            allRepos = repos;
            document.getElementById('repoList').innerHTML = '';
        } else {
            allRepos = [...allRepos, ...repos];
        }
        
        filteredRepos = allRepos;
        displayRepos();
        
        // Show/hide load more button
        const loadMoreBtn = document.getElementById('loadMoreRepos');
        loadMoreBtn.style.display = repos.length === reposPerPage ? 'block' : 'none';
        
        currentPage = page;
    } catch (err) {
        console.error('Failed to load repositories:', err);
        document.getElementById('repoList').innerHTML = '<div style="padding:20px; text-align:center; color:#f44;">Failed to load repositories</div>';
    }
}

async function loadGitLabRepos(page = 1) {
    try {
        const response = await fetch(`https://gitlab.com/api/v4/projects?per_page=${reposPerPage}&page=${page}&order_by=updated&sort=desc&membership=true`, {
            headers: {
                'Authorization': `Bearer ${authState.token}`,
            },
        });
        
        if (!response.ok) throw new Error('Failed to load repositories');
        const repos = await response.json();
        
        if (page === 1) {
            allRepos = repos;
            document.getElementById('repoList').innerHTML = '';
        } else {
            allRepos = [...allRepos, ...repos];
        }
        
        filteredRepos = allRepos;
        displayGitLabRepos();
        
        // Show/hide load more button
        const loadMoreBtn = document.getElementById('loadMoreRepos');
        loadMoreBtn.style.display = repos.length === reposPerPage ? 'block' : 'none';
        
        currentPage = page;
    } catch (err) {
        console.error('Failed to load repositories:', err);
        document.getElementById('repoList').innerHTML = '<div style="padding:20px; text-align:center; color:#f44;">Failed to load repositories</div>';
    }
}

function displayRepos() {
    const repoList = document.getElementById('repoList');
    const searchTerm = document.getElementById('repoSearch').value.toLowerCase();
    
    // Filter repos
    filteredRepos = allRepos.filter(repo => 
        repo.name.toLowerCase().includes(searchTerm) ||
        repo.description?.toLowerCase().includes(searchTerm) ||
        repo.owner.login.toLowerCase().includes(searchTerm)
    );
    
    if (filteredRepos.length === 0) {
        repoList.innerHTML = '<div style="padding:20px; text-align:center; color:#555;">No repositories found</div>';
        return;
    }
    
    repoList.innerHTML = filteredRepos.map(repo => `
        <div class="repo-item" onclick="selectRepo('${repo.full_name}', 'github')" style="padding:12px; border-bottom:1px solid #222; cursor:pointer; transition:background 0.2s;">
            <div style="display:flex; align-items:start; gap:12px;">
                <img src="${repo.owner.avatar_url}" style="width:32px; height:32px; border-radius:4px;">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:bold; color:#fff; margin-bottom:4px;">
                        ${repo.owner.login}/${repo.name}
                        ${repo.private ? '<span style="background:#f44; color:#fff; padding:2px 6px; border-radius:3px; font-size:10px; margin-left:8px;">Private</span>' : ''}
                        ${repo.fork ? '<span style="background:#666; color:#fff; padding:2px 6px; border-radius:3px; font-size:10px; margin-left:4px;">Fork</span>' : ''}
                    </div>
                    ${repo.description ? `<div style="color:#888; font-size:12px; margin-bottom:4px; line-height:1.4;">${repo.description}</div>` : ''}
                    <div style="color:#666; font-size:11px;">
                        ⭐ ${repo.stargazers_count} · 🍴 ${repo.forks_count} · ${repo.language || 'Unknown'}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add hover effect
    repoList.querySelectorAll('.repo-item').forEach(item => {
        item.addEventListener('mouseenter', () => item.style.background = '#1a1a1a');
        item.addEventListener('mouseleave', () => item.style.background = 'transparent');
    });
}

function displayGitLabRepos() {
    const repoList = document.getElementById('repoList');
    const searchTerm = document.getElementById('repoSearch').value.toLowerCase();
    
    // Filter repos
    filteredRepos = allRepos.filter(repo => 
        repo.name.toLowerCase().includes(searchTerm) ||
        repo.description?.toLowerCase().includes(searchTerm) ||
        repo.owner?.username?.toLowerCase().includes(searchTerm) ||
        repo.namespace?.full_path?.toLowerCase().includes(searchTerm)
    );
    
    if (filteredRepos.length === 0) {
        repoList.innerHTML = '<div style="padding:20px; text-align:center; color:#555;">No repositories found</div>';
        return;
    }
    
    repoList.innerHTML = filteredRepos.map(repo => `
        <div class="repo-item" onclick="selectRepo('${repo.path_with_namespace}', 'gitlab')" style="padding:12px; border-bottom:1px solid #222; cursor:pointer; transition:background 0.2s;">
            <div style="display:flex; align-items:start; gap:12px;">
                <img src="${repo.avatar_url || repo.owner?.avatar_url}" style="width:32px; height:32px; border-radius:4px;">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:bold; color:#fff; margin-bottom:4px;">
                        ${repo.path_with_namespace}
                        ${repo.visibility === 'private' ? '<span style="background:#f44; color:#fff; padding:2px 6px; border-radius:3px; font-size:10px; margin-left:8px;">Private</span>' : ''}
                        ${repo.forked_from_project ? '<span style="background:#666; color:#fff; padding:2px 6px; border-radius:3px; font-size:10px; margin-left:4px;">Fork</span>' : ''}
                    </div>
                    ${repo.description ? `<div style="color:#888; font-size:12px; margin-bottom:4px; line-height:1.4;">${repo.description}</div>` : ''}
                    <div style="color:#666; font-size:11px;">
                        ⭐ ${repo.star_count} · 🍴 ${repo.forks_count} · ${repo.topics?.[0] || 'Unknown'}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add hover effect
    repoList.querySelectorAll('.repo-item').forEach(item => {
        item.addEventListener('mouseenter', () => item.style.background = '#1a1a1a');
        item.addEventListener('mouseleave', () => item.style.background = 'transparent');
    });
}

function selectRepo(fullName, provider = 'github') {
    const url = provider === 'gitlab' 
        ? `https://gitlab.com/${fullName}` 
        : `https://github.com/${fullName}`;
    document.getElementById('repoInput').value = url;
    document.getElementById('startBtn').disabled = false;
    loadAndStart();
}

function loadMoreRepos() {
    if (authState.provider === 'github') {
        loadGitHubRepos(currentPage + 1);
    } else if (authState.provider === 'gitlab') {
        loadGitLabRepos(currentPage + 1);
    }
}

// Add search handler
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('repoSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (authState.provider === 'gitlab') {
                displayGitLabRepos();
            } else {
                displayRepos();
            }
        });
    }
});

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

    create3DCodeBoard();

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

function getFileTypeColor(ext) {
    const colors = {
        'js': 0xf7df1e,
        'ts': 0x3178c6,
        'py': 0x3776ab,
        'java': 0xb07219,
        'go': 0x00add8,
        'rs': 0xdea584,
        'cpp': 0xf34b7d,
        'c': 0x555555,
        'cs': 0x239120,
        'rb': 0x701516,
        'php': 0x4f5d95,
        'swift': 0xf05138,
        'kt': 0x7f52ff,
        'scala': 0xdc322f,
        'html': 0xe34c26,
        'css': 0x563d7c,
        'scss': 0xc6538c,
        'json': 0xcbcb41,
        'md': 0x083fa1,
        'yaml': 0xcb171e,
        'yml': 0xcb171e,
        'sql': 0xcc2927,
        'sh': 0x89e051,
        'bash': 0x89e051,
        'tsx': 0x61dafb,
        'jsx': 0x61dafb,
        'vue': 0x41b883,
        'svelte': 0xff3e00,
    };
    return colors[ext.toLowerCase()] || 0x888888;
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

        // File type indicator (small colored dot)
        const typeColor = getFileTypeColor(node.lang || node.id.split('.').pop());
        const typeGeo = new THREE.SphereGeometry(size * 0.3, 8, 8);
        const typeMat = new THREE.MeshBasicMaterial({ color: typeColor });
        const typeIndicator = new THREE.Mesh(typeGeo, typeMat);
        typeIndicator.position.set(size * 0.8, size * 0.8, 0);
        mesh.add(typeIndicator);

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

    const hitMaterial = new THREE.LineBasicMaterial({
        color: 0x1a3a5a,
        transparent: true,
        opacity: 0
    });

    for (const edge of graphData.edges) {
        const fromMesh = nodeMeshes.get(edge.from);
        const toMesh = nodeMeshes.get(edge.to);
        if (!fromMesh || !toMesh) continue;

        const points = [fromMesh.position.clone(), toMesh.position.clone()];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geo, edgeMaterial.clone());
        line.userData = { from: edge.from, to: edge.to, isEdge: true };
        scene.add(line);
        edgeLines.push(line);

        // Invisible thicker line for raycasting
        const hitGeo = new THREE.BufferGeometry().setFromPoints(points);
        const hitLine = new THREE.Line(hitGeo, hitMaterial.clone());
        hitLine.userData = { from: edge.from, to: edge.to, isEdge: true, isHitTarget: true };
        hitLine.renderOrder = -1;
        scene.add(hitLine);
        edgeLines.push(hitLine);
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
    
    // Sort definitions by line number for stack layout
    const sortedDefs = [...node.definitions].sort((a, b) => (a.line || 0) - (b.line || 0));
    const count = sortedDefs.length;
    const orbitRadius = mesh.userData.baseSize + 3 + count * 0.15;
    const SPACING = 2.2;

    for (let i = 0; i < count; i++) {
        const def = sortedDefs[i];
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

        // Function label with line range
        const labelText = fileLayoutMode 
            ? `${def.name} (ln ${def.line})` 
            : def.name;
        const label = createTextSprite(labelText, kindColor, 28);
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
    raycastTargets = nodeMeshArray.concat(functionMeshArray).concat(edgeLines.filter(l => l.userData.isHitTarget));
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

function getNodeById(nodeId) {
    return graphData.nodes.find((node) => node.id === nodeId) || null;
}

function getPrimaryDefinitionLabel(node) {
    if (!node || !node.definitions || node.definitions.length === 0) {
        return node ? node.label : '';
    }
    const fn = node.definitions.find((def) => def.kind === 'function') || node.definitions[0];
    return `${fn.name}()`;
}

function getGraphSymbolEdges() {
    if (!graphData || !Array.isArray(graphData.symbolEdges)) return [];
    if (graphData.symbolEdges.length === 0) return [];
    return graphData.symbolEdges;
}

function getSymbolEdgeKey(edge) {
    if (!edge) return '';
    return `${edge.fromFile}|${edge.fromSymbol}|${edge.toFile}|${edge.toSymbol}|${edge.callLine}`;
}

function highlightExecutionSymbolLane(symbolEdge) {
    if (!symbolEdge) return;
    resetCallChainHighlight();
    const nodeIds = new Set([symbolEdge.fromFile]);
    if (symbolEdge.toFile && symbolEdge.toFile !== symbolEdge.fromFile) {
        nodeIds.add(symbolEdge.toFile);
    }
    for (const nodeId of nodeIds) {
        const mesh = nodeMeshes.get(nodeId);
        if (!mesh) continue;
        mesh.material.emissiveIntensity = 0.55;
        mesh.scale.setScalar(1.15);
        activeCallChain.nodeIds.add(nodeId);
    }
    const edgeIndex = edgesByPair[`${symbolEdge.fromFile}->${symbolEdge.toFile}`];
    if (edgeIndex === undefined || !edgeLines[edgeIndex]) return;
    edgeLines[edgeIndex].material.opacity = 0.9;
    edgeLines[edgeIndex].material.color.setHex(0x00ff88);
    activeCallChain.outboundEdgeIndices.add(edgeIndex);
}

function selectExecutionSymbolPath(symbolEdge, focusNodeId, panelNodeId = null) {
    if (!symbolEdge) return;
    selectedPathEdgeKey = getSymbolEdgeKey(symbolEdge);
    selectedNodeId = panelNodeId || symbolEdge.fromFile;
    highlightExecutionSymbolLane(symbolEdge);
    updateExecutionPathPanel(selectedNodeId);
    const destination = focusNodeId || symbolEdge.toFile;
    if (destination && nodeMeshes.has(destination)) {
        flyToNode(destination);
    }
}

function renderExecutionPathGroup(results, title) {
    const div = document.createElement('div');
    div.className = 'ep-row';
    div.innerHTML = `<span class="ep-kind">${title}</span><div class="ep-path"></div>`;
    results.appendChild(div);
}

function renderSymbolExecutionRow(results, edge, direction, panelNodeId) {
    const targetId = direction === 'out' ? edge.toFile : edge.fromFile;
    const target = getNodeById(targetId);
    if (!target) return;
    const div = document.createElement('div');
    const edgeKey = getSymbolEdgeKey(edge);
    const kind = direction === 'out' ? 'CALLS' : 'CALLED BY';
    const activeStyle = edgeKey === selectedPathEdgeKey ? ' style="border-color:#6ef5a0;"' : '';
    const label = `${edge.fromSymbol}:${edge.callLine} → ${edge.toSymbol}:${edge.toLine}`;
    const location = `${edge.fromFile}:${edge.callLine} → ${edge.toFile}:${edge.toLine}`;
    div.className = 'ep-row';
    div.innerHTML = `<span class="ep-kind">${kind}</span><span${activeStyle}>${escapeHtml(label)}</span><div class="ep-path">${escapeHtml(location)}</div>`;
    div.onclick = () => selectExecutionSymbolPath(edge, targetId, panelNodeId);
    results.appendChild(div);
}

function updateExecutionPathPanelFallback(nodeId, node, summary, results) {
    const outbound = (adjacencyOutList[nodeId] || []).slice(0, 12);
    const inbound = (adjacencyInList[nodeId] || []).slice(0, 12);
    summary.textContent = `${node.fullPath} · ${inbound.length} callers/dependents · ${outbound.length} calls/dependencies`;

    const renderRow = (kind, targetId) => {
        const target = getNodeById(targetId);
        if (!target) return;
        const div = document.createElement('div');
        div.className = 'ep-row';
        div.innerHTML = `<span class="ep-kind">${kind}</span>${escapeHtml(getPrimaryDefinitionLabel(target))}<div class="ep-path">${escapeHtml(target.fullPath)}</div>`;
        div.onclick = () => selectExecutionPathNode(targetId, true);
        results.appendChild(div);
    };

    inbound.forEach((id) => renderRow('IN', id));
    outbound.forEach((id) => renderRow('OUT', id));
}

function updateExecutionPathPanelWithSymbols(nodeId, node, summary, results, symbolEdges) {
    const outbound = symbolEdges.filter((edge) => edge.fromFile === nodeId).slice(0, 16);
    const inbound = symbolEdges.filter((edge) => edge.toFile === nodeId).slice(0, 16);
    summary.textContent = `${node.fullPath} · ${inbound.length} called by · ${outbound.length} calls`;

    if (inbound.length > 0) {
        renderExecutionPathGroup(results, 'CALLED BY');
        inbound.forEach((edge) => renderSymbolExecutionRow(results, edge, 'in', nodeId));
    }
    if (outbound.length > 0) {
        renderExecutionPathGroup(results, 'CALLS');
        outbound.forEach((edge) => renderSymbolExecutionRow(results, edge, 'out', nodeId));
    }
    if (inbound.length === 0 && outbound.length === 0) {
        renderExecutionPathGroup(results, 'NO SYMBOL PATHS');
    }
}

function selectExecutionPathNode(nodeId, shouldFly = true) {
    if (!nodeId || !nodeMeshes.has(nodeId)) return;
    selectedNodeId = nodeId;
    selectedPathEdgeKey = null;
    resetCallChainHighlight();
    applyCallChainHighlight(nodeId);
    updateExecutionPathPanel(nodeId);
    if (shouldFly) {
        flyToNode(nodeId);
    }
}

function updateExecutionPathPanel(nodeId) {
    const panel = document.getElementById('executionPathPanel');
    const summary = document.getElementById('executionPathSummary');
    const results = document.getElementById('executionPathResults');
    const node = getNodeById(nodeId);
    if (!panel || !summary || !results || !node) return;

    results.innerHTML = '';
    const current = document.createElement('div');
    current.className = 'ep-row';
    current.innerHTML = `<span class="ep-kind">SELECTED</span>${escapeHtml(getPrimaryDefinitionLabel(node))}<div class="ep-path">${escapeHtml(node.fullPath)}</div>`;
    current.onclick = () => flyToNode(nodeId);
    results.appendChild(current);

    const symbolEdges = getGraphSymbolEdges();
    if (symbolEdges.length > 0) {
        updateExecutionPathPanelWithSymbols(nodeId, node, summary, results, symbolEdges);
    } else {
        updateExecutionPathPanelFallback(nodeId, node, summary, results);
    }

    panel.style.display = 'block';
}

function buildPathSearchIndex() {
    pathSearchIndex = [];
    const symbolEdges = getGraphSymbolEdges();
    if (symbolEdges.length > 0) {
        for (const edge of symbolEdges) {
            pathSearchIndex.push({
                type: 'path',
                name: `${edge.fromSymbol} → ${edge.toSymbol}`,
                path: `${edge.fromFile}:${edge.callLine} → ${edge.toFile}:${edge.toLine}`,
                fromId: edge.fromFile,
                toId: edge.toFile,
                nodeId: edge.fromFile,
                symbolEdge: edge,
            });
        }
        return;
    }

    for (const edge of graphData.edges) {
        const from = getNodeById(edge.from);
        const to = getNodeById(edge.to);
        if (!from || !to) continue;
        const fromLabel = getPrimaryDefinitionLabel(from);
        const toLabel = getPrimaryDefinitionLabel(to);
        pathSearchIndex.push({
            type: 'path',
            name: `${fromLabel} → ${toLabel}`,
            path: `${from.fullPath} → ${to.fullPath}`,
            fromId: from.id,
            toId: to.id,
            nodeId: from.id,
        });
    }
}

function resolveHoverTarget(intersects) {
    if (!intersects || intersects.length === 0) {
        return null;
    }

    let target = intersects[0].object;

    if (target.userData.isEdge) {
        return {
            isEdge: true,
            from: target.userData.from,
            to: target.userData.to,
            edgeLine: target
        };
    }

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

function showEdgeDetails(fromPath, toPath) {
    const panel = document.getElementById('functionPanel');
    const list = document.getElementById('functionList');
    const fromNode = getNodeById(fromPath);
    const toNode = getNodeById(toPath);

    panel.style.display = 'block';
    document.getElementById('functionFileName').textContent = 'IMPORT RELATIONSHIP';
    document.getElementById('functionCount').textContent = 'Dependency';

    const fromHtml = fromNode 
        ? `<div style="color:#8f8; font-size:12px; margin-bottom:4px;">${escapeHtml(fromPath)}</div><div style="color:#666; font-size:11px;">${fromNode.lines} lines · ${fromNode.lang}</div>`
        : `<div style="color:#f66; font-size:12px;">${escapeHtml(fromPath)} (not found)</div>`;

    const toHtml = toNode
        ? `<div style="color:#8f8; font-size:12px; margin-bottom:4px;">${escapeHtml(toPath)}</div><div style="color:#666; font-size:11px;">${toNode.lines} lines · ${toNode.lang}</div>`
        : `<div style="color:#f66; font-size:12px;">${escapeHtml(toPath)} (not found)</div>`;

    list.innerHTML = `
        <div class="fn-item" style="border-bottom:none; padding:2px 0 0;">
            <div style="color:#b0f; font-weight:bold; margin-bottom:8px;">FROM</div>
            ${fromHtml}
            <div style="color:#b0f; font-weight:bold; margin:12px 0 8px;">TO</div>
            ${toHtml}
            <div style="margin-top:12px; color:#666; font-size:11px;">Click file nodes to view code</div>
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

function getWsPortFromMeta() {
    const meta = document.querySelector('meta[name="ws-port"]');
    if (!meta) return '8091';
    const value = (meta.getAttribute('content') || '').trim();
    return value || '8091';
}

function buildMultiplayerWsUrl(roomId) {
    if (MULTIPLAYER_HOST) {
        return `${MULTIPLAYER_HOST.replace(/^http/, 'ws')}/room/${encodeURIComponent(roomId)}`;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const wsPort = getWsPortFromMeta();
    return `${protocol}//${host}:${wsPort}/room/${encodeURIComponent(roomId)}`;
}

// Assign each browser session a stable random color
const myColor = `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`;

function connectMultiplayer() {
    if (!graphData || !graphData.meta || !graphData.meta.repo) {
        document.getElementById('onlineCount').textContent = '1';
        return;
    }

    if (graphData.meta.provider === 'local') {
        document.getElementById('onlineCount').textContent = '1';
        return;
    }

    const roomId = graphData.meta.repo;
    const wsUrl = buildMultiplayerWsUrl(roomId);

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

        if (msg.type === 'welcome') {
            myPlayerId = msg.playerId;
            document.getElementById('onlineCount').textContent = String(msg.players.length + 1);

            // Create existing players
            for (const player of msg.players) {
                if (player.id !== myPlayerId) {
                    createRemotePlayer({
                        id: player.id,
                        nickname: player.nickname,
                        color: player.color,
                        position: player.position,
                    });
                }
            }

            // Create existing agents
            if (msg.agents) {
                for (const agent of msg.agents) {
                    if (!agents.has(agent.id)) {
                        createAgentMesh(agent);
                    }
                }
            }
        }

        if (msg.type === 'chat') {
            addChatMessage(`${msg.nickname}: ${msg.text}`, '#8ff');
        }

        if (msg.type === 'leave') {
            removeRemotePlayer(msg.id);
            updateOnlineCount();
        }

        if (msg.type === 'agent_joined') {
            createAgentMesh(msg.agent);
            addChatMessage(`Agent ${msg.agent.name} joined`, '#b0f');
        }

        if (msg.type === 'agent_left') {
            removeAgentMesh(msg.agentId);
            addChatMessage(`Agent left`, '#b0f');
        }

        if (msg.type === 'agent_update') {
            updateAgentPosition(msg.agentId, msg.position);
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

function createAgentMesh(agentData) {
    const group = new THREE.Group();
    const agentColor = { h: 280, s: 100, l: 60 };

    // Body - different shape to distinguish from players
    const bodyGeo = new THREE.OctahedronGeometry(0.5, 0);
    const bodyMat = new THREE.MeshPhongMaterial({
        color: hslToHex(agentColor),
        emissive: hslToHex(agentColor),
        emissiveIntensity: 0.4,
        shininess: 50,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Inner core
    const coreGeo = new THREE.IcosahedronGeometry(0.25, 0);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Orbiting ring
    const ringGeo = new THREE.TorusGeometry(0.8, 0.05, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: hslToHex(agentColor),
        transparent: true,
        opacity: 0.5,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // Name label
    const label = createTextSprite(agentData.name, hslToHex(agentColor), 20);
    label.position.set(0, 1.8, 0);
    label.scale.set(3.5, 1.8, 1);
    group.add(label);

    if (agentData.position) {
        group.position.set(agentData.position.x, agentData.position.y, agentData.position.z);
    }

    scene.add(group);
    agentMeshes.set(agentData.id, {
        group: group,
        data: agentData,
        ring: ring,
        core: core,
    });
    agents.set(agentData.id, agentData);
}

function updateAgentPosition(agentId, position) {
    const agentMesh = agentMeshes.get(agentId);
    if (!agentMesh) return;
    agentMesh.group.position.set(position.x, position.y, position.z);
}

function removeAgentMesh(agentId) {
    const agentMesh = agentMeshes.get(agentId);
    if (!agentMesh) return;
    scene.remove(agentMesh.group);
    agentMeshes.delete(agentId);
    agents.delete(agentId);
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
// CODE BOARD
// ============================================================
function create3DCodeBoard() {
    const boardWidth = 40;
    const boardHeight = 25;
    
    // Front canvas (code)
    codeBoardCanvas = document.createElement('canvas');
    codeBoardCanvas.width = 2048;
    codeBoardCanvas.height = 1280;
    codeBoardCtx = codeBoardCanvas.getContext('2d');
    
    codeBoardTexture = new THREE.CanvasTexture(codeBoardCanvas);
    codeBoardTexture.minFilter = THREE.LinearFilter;
    codeBoardTexture.magFilter = THREE.LinearFilter;
    
    // Back canvas (details)
    codeBoardBackCanvas = document.createElement('canvas');
    codeBoardBackCanvas.width = 2048;
    codeBoardBackCanvas.height = 1280;
    codeBoardBackCtx = codeBoardBackCanvas.getContext('2d');
    
    codeBoardBackTexture = new THREE.CanvasTexture(codeBoardBackCanvas);
    codeBoardBackTexture.minFilter = THREE.LinearFilter;
    codeBoardBackTexture.magFilter = THREE.LinearFilter;
    
    const boardGeo = new THREE.PlaneGeometry(boardWidth, boardHeight);
    
    // Create materials array for front and back
    const frontMat = new THREE.MeshBasicMaterial({
        map: codeBoardTexture,
        side: THREE.FrontSide,
        transparent: true,
        opacity: 0.95
    });
    
    const backMat = new THREE.MeshBasicMaterial({
        map: codeBoardBackTexture,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.95
    });
    
    codeBoardMesh = new THREE.Mesh(boardGeo, [frontMat, backMat]);
    codeBoardMesh.position.set(0, 40, 60);
    codeBoardMesh.rotation.y = Math.PI;
    scene.add(codeBoardMesh);
    
    // Add frame
    const frameGeo = new THREE.BoxGeometry(boardWidth + 0.5, boardHeight + 0.5, 0.2);
    const frameMat = new THREE.MeshBasicMaterial({ color: 0x8a2be2 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.z = -0.15;
    codeBoardMesh.add(frame);
    
    // Initial render
    renderCodeBoardEmpty();
    renderCodeBoardBackEmpty();
}

function renderCodeBoardEmpty() {
    if (!codeBoardCtx) return;
    
    codeBoardCtx.fillStyle = '#0a0a15';
    codeBoardCtx.fillRect(0, 0, codeBoardCanvas.width, codeBoardCanvas.height);
    
    codeBoardCtx.fillStyle = '#8a2be2';
    codeBoardCtx.font = 'bold 48px Courier New';
    codeBoardCtx.textAlign = 'center';
    codeBoardCtx.fillText('CODE BOARD', codeBoardCanvas.width / 2, codeBoardCanvas.height / 2);
    
    codeBoardCtx.fillStyle = '#666';
    codeBoardCtx.font = '24px Courier New';
    codeBoardCtx.fillText('Click a function to view code', codeBoardCanvas.width / 2, codeBoardCanvas.height / 2 + 40);
    
    if (codeBoardTexture) {
        codeBoardTexture.needsUpdate = true;
    }
}

function renderCodeBoardBackEmpty() {
    if (!codeBoardBackCtx) return;
    
    codeBoardBackCtx.fillStyle = '#0a0a15';
    codeBoardBackCtx.fillRect(0, 0, codeBoardBackCanvas.width, codeBoardBackCanvas.height);
    
    codeBoardBackCtx.fillStyle = '#8a2be2';
    codeBoardBackCtx.font = 'bold 48px Courier New';
    codeBoardBackCtx.textAlign = 'center';
    codeBoardBackCtx.fillText('DETAILS', codeBoardBackCanvas.width / 2, codeBoardBackCanvas.height / 2);
    
    codeBoardBackCtx.fillStyle = '#666';
    codeBoardBackCtx.font = '24px Courier New';
    codeBoardBackCtx.fillText('Walk around to see execution paths', codeBoardBackCanvas.width / 2, codeBoardBackCanvas.height / 2 + 40);
    
    if (codeBoardBackTexture) {
        codeBoardBackTexture.needsUpdate = true;
    }
}

function renderCodeToBoard(nodeData, functionData) {
    if (!codeBoardCtx || !nodeData) return;
    
    codeBoardCtx.fillStyle = '#0a0a15';
    codeBoardCtx.fillRect(0, 0, codeBoardCanvas.width, codeBoardCanvas.height);
    
    // Title
    codeBoardCtx.fillStyle = '#8f8';
    codeBoardCtx.font = 'bold 32px Courier New';
    codeBoardCtx.textAlign = 'left';
    codeBoardCtx.fillText(nodeData.label, 20, 40);
    
    if (functionData) {
        codeBoardCtx.fillStyle = '#b0f';
        codeBoardCtx.fillText(`- ${functionData.functionName} (${functionData.functionKind})`, 20, 80);
    }
    
    // Code content
    if (nodeData.content && nodeData.content.length > 0) {
        const lines = nodeData.content.split('\n');
        const lineHeight = 28;
        const startY = 120;
        const maxLines = Math.floor((codeBoardCanvas.height - startY) / lineHeight);
        
        let startLine = 0;
        if (functionData && functionData.functionLine) {
            startLine = Math.max(0, functionData.functionLine - Math.floor(maxLines / 2));
        }
        
        const endLine = Math.min(lines.length, startLine + maxLines);
        const codeLines = lines.slice(startLine, endLine);
        
        codeBoardCtx.font = '22px Courier New';
        
        for (let i = 0; i < codeLines.length; i++) {
            const lineNum = startLine + i + 1;
            const y = startY + i * lineHeight;
            
            // Line number
            codeBoardCtx.fillStyle = '#666';
            codeBoardCtx.textAlign = 'right';
            codeBoardCtx.fillText(String(lineNum), 80, y);
            
            // Code
            const isTargetLine = functionData && lineNum === functionData.functionLine;
            if (isTargetLine) {
                codeBoardCtx.fillStyle = 'rgba(138, 43, 226, 0.3)';
                codeBoardCtx.fillRect(90, y - 20, codeBoardCanvas.width - 110, lineHeight);
            }
            
            codeBoardCtx.fillStyle = isTargetLine ? '#fff' : '#e0e0e0';
            codeBoardCtx.textAlign = 'left';
            codeBoardCtx.fillText(escapeHtml(codeLines[i]) || ' ', 100, y);
        }
    } else {
        codeBoardCtx.fillStyle = '#f66';
        codeBoardCtx.font = '24px Courier New';
        codeBoardCtx.textAlign = 'center';
        codeBoardCtx.fillText('File content not available', codeBoardCanvas.width / 2, codeBoardCanvas.height / 2);
        codeBoardCtx.fillStyle = '#666';
        codeBoardCtx.font = '18px Courier New';
        codeBoardCtx.fillText('This graph was generated without file content', codeBoardCanvas.width / 2, codeBoardCanvas.height / 2 + 30);
        codeBoardCtx.fillText('Reload the repository to include full file content', codeBoardCanvas.width / 2, codeBoardCanvas.height / 2 + 55);
    }
    
    if (codeBoardTexture) {
        codeBoardTexture.needsUpdate = true;
    }
}

function showCodeBoard(nodeData, functionData) {
    if (!nodeData) return;
    
    renderCodeToBoard(nodeData, functionData);
    renderCodeBoardBack(nodeData, functionData);
    
    // Position board in front of player
    if (codeBoardMesh && playerGroup) {
        const playerPos = playerGroup.position.clone();
        const playerDir = new THREE.Vector3(0, 0, -1);
        playerDir.applyQuaternion(playerGroup.quaternion);
        
        codeBoardMesh.position.copy(playerPos).add(playerDir.multiplyScalar(30));
        codeBoardMesh.position.y = playerPos.y + 5;
        codeBoardMesh.lookAt(playerPos);
    }
}

function closeCodeBoard() {
    document.getElementById('codeBoard').style.display = 'none';
    renderCodeBoardEmpty();
    renderCodeBoardBackEmpty();
}

function renderCodeBoardBack(nodeData, functionData) {
    if (!codeBoardBackCtx || !nodeData) return;
    
    codeBoardBackCtx.fillStyle = '#0a0a15';
    codeBoardBackCtx.fillRect(0, 0, codeBoardBackCanvas.width, codeBoardBackCanvas.height);
    
    let y = 60;
    const lineHeight = 35;
    
    // Title
    codeBoardBackCtx.fillStyle = '#8f8';
    codeBoardBackCtx.font = 'bold 36px Courier New';
    codeBoardBackCtx.textAlign = 'left';
    codeBoardBackCtx.fillText('FILE DETAILS', 40, y);
    y += lineHeight * 1.5;
    
    // File metadata
    codeBoardBackCtx.fillStyle = '#e0e0e0';
    codeBoardBackCtx.font = '24px Courier New';
    codeBoardBackCtx.fillText(`Path: ${nodeData.fullPath}`, 40, y);
    y += lineHeight;
    codeBoardBackCtx.fillText(`Language: ${nodeData.lang || 'unknown'}`, 40, y);
    y += lineHeight;
    codeBoardBackCtx.fillText(`Lines: ${nodeData.lines}`, 40, y);
    y += lineHeight;
    codeBoardBackCtx.fillText(`Size: ${formatBytes(nodeData.size || 0)}`, 40, y);
    y += lineHeight * 1.5;
    
    // Dependencies
    const deps = nodeData.dependencies || [];
    if (deps.length > 0) {
        codeBoardBackCtx.fillStyle = '#b0f';
        codeBoardBackCtx.font = 'bold 28px Courier New';
        codeBoardBackCtx.fillText(`DEPENDENCIES (${deps.length})`, 40, y);
        y += lineHeight;
        
        codeBoardBackCtx.fillStyle = '#e0e0e0';
        codeBoardBackCtx.font = '20px Courier New';
        const maxDeps = 15;
        for (let i = 0; i < Math.min(deps.length, maxDeps); i++) {
            codeBoardBackCtx.fillText(`  → ${deps[i]}`, 40, y);
            y += lineHeight * 0.8;
        }
        if (deps.length > maxDeps) {
            codeBoardBackCtx.fillStyle = '#666';
            codeBoardBackCtx.fillText(`  ... and ${deps.length - maxDeps} more`, 40, y);
            y += lineHeight * 0.8;
        }
        y += lineHeight;
    }
    
    // Function details
    if (functionData) {
        y += lineHeight * 0.5;
        codeBoardBackCtx.fillStyle = '#ff8800';
        codeBoardBackCtx.font = 'bold 28px Courier New';
        codeBoardBackCtx.fillText('FUNCTION', 40, y);
        y += lineHeight;
        
        codeBoardBackCtx.fillStyle = '#e0e0e0';
        codeBoardBackCtx.font = '24px Courier New';
        codeBoardBackCtx.fillText(`Name: ${functionData.functionName}`, 40, y);
        y += lineHeight;
        codeBoardBackCtx.fillText(`Kind: ${functionData.functionKind}`, 40, y);
        y += lineHeight;
        codeBoardBackCtx.fillText(`Line: ${functionData.functionLine}`, 40, y);
        y += lineHeight * 1.5;
        
        // Execution paths
        const symbolEdges = graphData.symbolEdges || [];
        const calls = symbolEdges.filter(e => 
            e.fromFile === nodeData.fullPath && 
            e.fromSymbol === functionData.functionName
        );
        const calledBy = symbolEdges.filter(e => 
            e.toFile === nodeData.fullPath && 
            e.toSymbol === functionData.functionName
        );
        
        if (calls.length > 0) {
            codeBoardBackCtx.fillStyle = '#0f8';
            codeBoardBackCtx.font = 'bold 26px Courier New';
            codeBoardBackCtx.fillText(`CALLS (${calls.length})`, 40, y);
            y += lineHeight;
            
            codeBoardBackCtx.fillStyle = '#e0e0e0';
            codeBoardBackCtx.font = '20px Courier New';
            const maxCalls = 10;
            for (let i = 0; i < Math.min(calls.length, maxCalls); i++) {
                const call = calls[i];
                codeBoardBackCtx.fillText(`  → ${call.toSymbol} (${call.toFile.split('/').pop()})`, 40, y);
                y += lineHeight * 0.8;
            }
            if (calls.length > maxCalls) {
                codeBoardBackCtx.fillStyle = '#666';
                codeBoardBackCtx.fillText(`  ... and ${calls.length - maxCalls} more`, 40, y);
                y += lineHeight * 0.8;
            }
            y += lineHeight;
        }
        
        if (calledBy.length > 0) {
            codeBoardBackCtx.fillStyle = '#f8f';
            codeBoardBackCtx.font = 'bold 26px Courier New';
            codeBoardBackCtx.fillText(`CALLED BY (${calledBy.length})`, 40, y);
            y += lineHeight;
            
            codeBoardBackCtx.fillStyle = '#e0e0e0';
            codeBoardBackCtx.font = '20px Courier New';
            const maxCalled = 10;
            for (let i = 0; i < Math.min(calledBy.length, maxCalled); i++) {
                const call = calledBy[i];
                codeBoardBackCtx.fillText(`  ← ${call.fromSymbol} (${call.fromFile.split('/').pop()})`, 40, y);
                y += lineHeight * 0.8;
            }
            if (calledBy.length > maxCalled) {
                codeBoardBackCtx.fillStyle = '#666';
                codeBoardBackCtx.fillText(`  ... and ${calledBy.length - maxCalled} more`, 40, y);
                y += lineHeight * 0.8;
            }
        }
    } else {
        // Show all definitions if no specific function selected
        const defs = nodeData.definitions || [];
        if (defs.length > 0) {
            y += lineHeight * 0.5;
            codeBoardBackCtx.fillStyle = '#ff8800';
            codeBoardBackCtx.font = 'bold 28px Courier New';
            codeBoardBackCtx.fillText(`DEFINITIONS (${defs.length})`, 40, y);
            y += lineHeight;
            
            codeBoardBackCtx.fillStyle = '#e0e0e0';
            codeBoardBackCtx.font = '20px Courier New';
            const maxDefs = 20;
            for (let i = 0; i < Math.min(defs.length, maxDefs); i++) {
                const def = defs[i];
                codeBoardBackCtx.fillText(`  ${def.kind}: ${def.name} (ln ${def.line})`, 40, y);
                y += lineHeight * 0.8;
            }
            if (defs.length > maxDefs) {
                codeBoardBackCtx.fillStyle = '#666';
                codeBoardBackCtx.fillText(`  ... and ${defs.length - maxDefs} more`, 40, y);
            }
        }
    }
    
    if (codeBoardBackTexture) {
        codeBoardBackTexture.needsUpdate = true;
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ============================================================
// AGENT PANEL
// ============================================================
function openAgentPanel() {
    const panel = document.getElementById('agentPanel');
    const agentList = document.getElementById('agentList');
    const agentSelect = document.getElementById('agentSelect');
    
    panel.style.display = 'block';
    
    // Populate agent list
    agentList.innerHTML = '';
    agentSelect.innerHTML = '<option value="">Select agent...</option>';
    
    for (const [id, agent] of agents) {
        const div = document.createElement('div');
        div.style.padding = '8px';
        div.style.marginBottom = '6px';
        div.style.background = 'rgba(138,43,226,0.1)';
        div.style.borderRadius = '6px';
        div.style.fontSize = '12px';
        div.innerHTML = `<span style="color:#b0f; font-weight:bold;">${agent.name}</span><br><span style="color:#666;">${agent.role}</span>`;
        agentList.appendChild(div);
        
        const option = document.createElement('option');
        option.value = id;
        option.textContent = agent.name;
        agentSelect.appendChild(option);
    }
    
    if (agents.size === 0) {
        agentList.innerHTML = '<div style="color:#666; font-size:12px; padding:8px;">No agents active. Create one via the API.</div>';
    }
}

function closeAgentPanel() {
    document.getElementById('agentPanel').style.display = 'none';
}

async function sendAgentMessage() {
    const agentId = document.getElementById('agentSelect').value;
    const message = document.getElementById('agentMessageInput').value.trim();
    const responseDiv = document.getElementById('agentResponse');
    
    if (!agentId) {
        alert('Please select an agent');
        return;
    }
    
    if (!message) {
        alert('Please enter a message');
        return;
    }
    
    responseDiv.style.display = 'block';
    responseDiv.innerHTML = '<span style="color:#8f8;">Thinking...</span>';
    
    try {
        const codeContext = buildCodeContext();
        const response = await fetch(`/api/agents/${agentId}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, codeContext })
        });
        
        const data = await response.json();
        
        if (data.error) {
            responseDiv.innerHTML = `<span style="color:#f66;">Error: ${data.error}</span>`;
        } else {
            responseDiv.innerHTML = `<span style="color:#b0f;">${escapeHtml(data.response)}</span>`;
        }
    } catch (error) {
        responseDiv.innerHTML = `<span style="color:#f66;">Error: ${error.message}</span>`;
    }
    
    document.getElementById('agentMessageInput').value = '';
}

function buildCodeContext() {
    if (!hoveredNode) return null;
    
    return {
        filePath: hoveredNode.fullPath,
        functionName: hoveredFunctionMesh ? hoveredFunctionMesh.userData.functionName : null,
        code: hoveredNode.content || null,
        dependencies: hoveredNode.dependencies || []
    };
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

        if (key === '?' && gameStarted) {
            const modal = document.getElementById('shortcutsModal');
            modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
            document.exitPointerLock();
        }

        if (key === 'z' && gameStarted) {
            zoomToFit();
        }

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
        if (key === 'a' && gameStarted) {
            const ap = document.getElementById('agentPanel');
            if (ap.style.display === 'block') {
                ap.style.display = 'none';
            } else {
                openAgentPanel();
                document.exitPointerLock();
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
            try {
                renderer.domElement.requestPointerLock();
            } catch (err) {
                console.error('Pointer lock failed:', err);
            }
            return;
        }

        if (!gameStarted || !isPointerLocked) {
            return;
        }

        const intersects = raycaster.intersectObjects(raycastTargets, true);
        const hoverTarget = resolveHoverTarget(intersects);

        if (hoverTarget && hoverTarget.isEdge) {
            showEdgeDetails(hoverTarget.from, hoverTarget.to);
            return;
        }

        if (hoveredFunctionMesh) {
            const ud = hoveredFunctionMesh.userData;
            const parentMesh = nodeMeshes.get(ud.parentNodeId);
            if (!parentMesh || !parentMesh.userData.nodeData) {
                throw new Error('Function node has no valid parent node data');
            }
            showCodeBoard(parentMesh.userData.nodeData, ud);
        } else if (hoveredNode) {
            selectExecutionPathNode(hoveredNode.id, false);
            if (hoveredNode.definitions && hoveredNode.definitions.length > 0) {
                toggleFunctionExpansion(hoveredNode.id);
            } else {
                showNodeFallbackPanel(hoveredNode);
            }
        } else {
            selectedNodeId = null;
            focusEdgesEnabled = false;
            updateEdgeVisibility();
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

    if (hoveredEdgeLine && hoveredEdgeLine !== hoverTarget?.edgeLine) {
        hoveredEdgeLine.material.opacity = 0.25;
        hoveredEdgeLine = null;
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

    if (hoverTarget.isEdge) {
        hoveredEdgeLine = hoverTarget.edgeLine;
        hoveredEdgeLine.material.opacity = 0.8;
        const tt = document.getElementById('hoverTooltip');
        if (tt) {
            tt.style.display = 'block';
            tt.innerHTML = `<div style="color:#8f8;font-size:13px;margin-bottom:4px;">IMPORT</div><div style="color:#aaa;font-size:11px;">${hoverTarget.from} → ${hoverTarget.to}</div><div style="color:#666;font-size:10px;margin-top:4px;">Click to see details</div>`;
        }
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
    if (!mesh) {
        console.error('flyToNode: mesh not found for nodeId', nodeId);
        return;
    }
    const target = mesh.position.clone();
    target.z += 25;
    target.y += 8;
    flyTarget.active = true;
    flyTarget.from = playerGroup.position.clone();
    flyTarget.to = target;
    flyTarget.progress = 0;
    console.log('Flying to node', nodeId, 'at position', target);
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

window.toggleFocusEdges = function() {
    if (!selectedNodeId) {
        alert('Select a node first to focus its edges');
        return;
    }
    focusEdgesEnabled = !focusEdgesEnabled;
    updateEdgeVisibility();
};

function updateEdgeVisibility() {
    for (const line of edgeLines) {
        if (line.userData.isHitTarget) continue;
        if (focusEdgesEnabled && selectedNodeId) {
            const isRelated = line.userData.from === selectedNodeId || line.userData.to === selectedNodeId;
            line.visible = isRelated;
        } else {
            line.visible = true;
        }
    }
}

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

window.runDeadCodeDetection = async function() {
    if (!currentRepoUrl) {
        alert('No repo loaded. Dead code detection requires a loaded repository.');
        return;
    }

    const resultsDiv = document.getElementById('analyticsResults');
    resultsDiv.innerHTML = '<div style="color:#ff0; font-size:11px;">Running dead code detection (knip + depcheck)... this may take up to 2 minutes.</div>';

    try {
        const response = await fetch('/api/deadcode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: currentRepoUrl }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Dead code detection failed');
        }

        const results = await response.json();

        let html = '<div style="color:#0f8; font-size:11px; margin-bottom:8px;">Dead code detection complete</div>';

        if (results.knip) {
            html += '<div style="color:#8f8; font-size:10px; margin-bottom:6px;"><strong>knip:</strong></div>';
            html += `<pre style="color:#aaa; font-size:9px; white-space:pre-wrap; margin-bottom:8px;">${escapeHtml(results.knip)}</pre>`;
        }

        if (results.depcheck) {
            html += '<div style="color:#8f8; font-size:10px; margin-bottom:6px;"><strong>depcheck:</strong></div>';
            html += `<pre style="color:#aaa; font-size:9px; white-space:pre-wrap; margin-bottom:8px;">${escapeHtml(results.depcheck)}</pre>`;
        }

        if (results.errors && results.errors.length > 0) {
            html += '<div style="color:#f44; font-size:10px; margin-bottom:6px;"><strong>Errors:</strong></div>';
            html += `<div style="color:#f88; font-size:9px;">${results.errors.map(e => escapeHtml(e)).join('<br>')}</div>`;
        }

        resultsDiv.innerHTML = html;
    } catch (err) {
        resultsDiv.innerHTML = `<div style="color:#f44; font-size:11px;">Error: ${escapeHtml(err.message)}</div>`;
    }
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

        // Animate agents
        const agentTime = Date.now() * 0.002;
        for (const [id, agentMesh] of agentMeshes) {
            agentMesh.ring.rotation.z = agentTime;
            agentMesh.core.rotation.y = agentTime * 0.5;
            agentMesh.core.rotation.x = agentTime * 0.3;
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
    buildPathSearchIndex();
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

window.closeShortcuts = function() {
    const modal = document.getElementById('shortcutsModal');
    if (!modal) {
        throw new Error('Shortcuts modal missing');
    }
    modal.style.display = 'none';
};

window.zoomToFit = function() {
    if (!gameStarted || nodeMeshes.size === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const mesh of nodeMeshes.values()) {
        const pos = mesh.position;
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
        minZ = Math.min(minZ, pos.z);
        maxZ = Math.max(maxZ, pos.z);
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const maxDim = Math.max(sizeX, sizeY, sizeZ);

    const targetDistance = maxDim * 2 + 20;
    cameraDistance = Math.min(targetDistance, maxCameraDistance);

    playerGroup.position.set(-centerX, -centerY, -centerZ);
    playerYaw = 0;
    playerPitch = 0;

    updateCameraView();
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
        showLoading(true, 0, `Scanning ${directoryHandle.name}...`);
        const data = await generateGraphFromLocalFolder(directoryHandle, (msg) => {
            statusEl.textContent = msg;
            showLoading(true, 0, msg);
        });
        assertGraphDataContract(data, 'Local folder load');

        // Compute new hashes and check for incremental sync
        const repoKey = getRepoKey(`local:${directoryHandle.name}`, 'local');
        const newHashes = {};
        for (const node of data.nodes) {
            newHashes[node.id] = await computeHash(node.content || '');
        }

        const cached = await loadCache(repoKey);
        if (cached.graphData && cached.hashMap) {
            const diff = diffHashes(cached.hashMap, newHashes);
            if (diff.changed.length === 0 && diff.added.length === 0 && diff.removed.length === 0) {
                data = cached.graphData;
            }
        }

        await saveCache(repoKey, data, newHashes);

        graphData = data;
        currentRepoUrl = null;
        showLoading(false);
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
    const source = searchIndex.concat(pathSearchIndex);
    const matches = source
        .filter(item => item.name.toLowerCase().includes(q) || item.path.toLowerCase().includes(q))
        .slice(0, 30);

    for (const match of matches) {
        const div = document.createElement('div');
        div.className = 'search-result';
        const kindLabel = match.type === 'file' ? 'FILE' : match.type === 'function' ? 'FN' : match.type === 'class' ? 'CLS' : match.type === 'path' ? 'PATH' : 'VAR';
        const lineInfo = match.line ? `:${match.line}` : '';
        div.innerHTML = `<span class="sr-kind">[${kindLabel}]</span> ${escapeHtml(match.name)} <span class="sr-file">${escapeHtml(match.path)}${lineInfo}</span>`;
        div.onclick = () => {
            if (match.type === 'path' && match.symbolEdge) {
                selectExecutionSymbolPath(match.symbolEdge, match.toId, match.fromId);
            } else if (match.type === 'path') {
                selectExecutionPathNode(match.fromId, true);
            } else {
                flyToNode(match.nodeId);
                selectExecutionPathNode(match.nodeId, false);
            }
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
        const repoKey = getRepoKey(url, 'main');
        const cached = await loadCache(repoKey);

        if (provider === 'github') {
            const token = getGitHubTokenForApi();
            data = await generateGraphFromGitHub(url, token, (msg) => {
                btn.textContent = msg;
                showLoading(true, 0, msg);
            });
        }
        if (provider === 'gitlab') {
            const token = getGitLabTokenForApi();
            if (!token) {
                throw new Error('GitLab private repos require login (Login with GitLab)');
            }
            data = await generateGraphFromGitLab(url, token, (msg) => {
                btn.textContent = msg;
                showLoading(true, 0, msg);
            });
        }

        assertGraphDataContract(data, 'Repository load');

        // Compute new hashes and check for incremental sync
        const newHashes = {};
        for (const node of data.nodes) {
            newHashes[node.id] = await computeHash(node.content || '');
        }

        if (cached.graphData && cached.hashMap) {
            const diff = diffHashes(cached.hashMap, newHashes);
            if (diff.changed.length === 0 && diff.added.length === 0 && diff.removed.length === 0) {
                data = cached.graphData;
            }
        }

        await saveCache(repoKey, data, newHashes);

        graphData = data;
        currentRepoUrl = url;
        showLoading(false);
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

function showLoading(on, progress = 0, message = '') {
    const bar = document.getElementById('loadingBar');
    const fill = bar.querySelector('.fill');
    const stats = document.getElementById('graphStats');
    
    if (on) {
        bar.style.display = 'block';
        if (progress > 0) {
            fill.style.width = Math.min(progress, 100) + '%';
        } else {
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
        }
        if (message && stats) {
            stats.textContent = message;
            stats.style.display = 'block';
        }
    } else {
        delete bar.dataset.active;
        bar.style.display = 'none';
        if (stats) stats.style.display = 'none';
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

function loadRecentRepos() {
    localStorage.removeItem(RECENT_REPOS_STORAGE_KEY);
    const container = document.getElementById('recentRepos');
    if (!container) {
        throw new Error('Recent repos container missing from DOM');
    }
    container.innerHTML = '';
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
    completeOAuthFromUrl().catch((err) => {
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

    updateAuthUi();
    loadConnectedProviderData();

    loadRecentRepos();
});
