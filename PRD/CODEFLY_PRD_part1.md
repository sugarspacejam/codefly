# CodeFly — PRD Part 1: Overview, Architecture, Local Folder Loading, Layout Modes
**Version:** 1.0 | **Date:** February 2026 | **Agent:** Codex implementation target

---

## 0. PRODUCT OVERVIEW

CodeFly is a **3D first-person codebase explorer**. Type a GitHub/GitLab URL or pick a local folder — the entire codebase renders as a navigable 3D graph in the browser. Files are glowing spheres connected by dependency edges. Folders are color-coded clusters. Functions and variables orbit their parent file node as smaller octahedra. You fly through it in real-time using WASD + mouse. Multiple people can be in the same repo simultaneously, see each other as avatar capsules, and chat.

### Core Rules (MANDATORY for all code changes)
- **Fail fast** — no `||` fallbacks, no silent failures. If something is missing, throw a clear error.
- **Single source of truth** — one property name per concept, everywhere.
- **No optional chaining with fallbacks** — `?.` is for safe access only, never combined with `||`.
- **No hardcoded logic where AI can decide** — no regex-based intent detection.

### Tech Stack
- Pure vanilla JS — no framework, no bundler, no build step
- Three.js r160 from CDN: `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js`
- `graph-generator.js` — client-side graph builder (GitHub API, GitLab API, File System Access API)
- `explorer.js` — 3D engine, UI, multiplayer client, auth, analytics (~2861 lines)
- `index.html` — single HTML file, all CSS inline in `<style>` block
- Cloudflare Durable Objects — multiplayer WebSocket rooms (in `/multiplayer/` subfolder)

### Absolute File Paths
- `/Volumes/waffleman/chentoledano/Projects-new/code-explorer/index.html`
- `/Volumes/waffleman/chentoledano/Projects-new/code-explorer/explorer.js`
- `/Volumes/waffleman/chentoledano/Projects-new/code-explorer/graph-generator.js`
- `/Volumes/waffleman/chentoledano/Projects-new/code-explorer/multiplayer/src/index.js`
- `/Volumes/waffleman/chentoledano/Projects-new/code-explorer/multiplayer/src/room.js`
- `/Volumes/waffleman/chentoledano/Projects-new/code-explorer/multiplayer/wrangler.toml`

---

## 1. GLOBAL STATE (explorer.js top-level declarations)

```javascript
// Three.js core
let graphData = null;           // { nodes, edges, meta } — loaded graph
let scene, camera, renderer;
let playerGroup;                // THREE.Group — player position/rotation container
let isPointerLocked = false;
let gameStarted = false;

// Movement
const keys = {};                // { 'w': true, 'shift': true, ... }
let playerYaw = 0;              // horizontal look angle (radians)
let playerPitch = 0;            // vertical look angle (radians)
const maxPitch = Math.PI / 2.2;
let mouseSensitivity = 0.002;
let isFlying = true;
let verticalVelocity = 0;
const gravity = -0.015;
const groundLevel = -50;
const baseSpeed = 0.8;
const boostMultiplier = 4;
let currentBoost = 1;
let isThirdPerson = false;
let cameraDistance = 15;
const minCameraDistance = 3;
const maxCameraDistance = 50;

// Graph scene objects
const nodeMeshes = new Map();   // nodeId -> THREE.Mesh (file nodes)
let nodeMeshArray = [];         // cached for raycasting
let functionMeshArray = [];     // all active function/variable node meshes
let raycastTargets = [];        // nodeMeshArray + functionMeshArray
const edgeLines = [];           // all THREE.Line objects for import edges

// Hover / selection
let hoveredNode = null;         // graphData node object
let hoveredNodeId = null;       // string id
let hoveredMesh = null;         // THREE.Mesh of hovered file node
let hoveredFunctionMesh = null; // THREE.Mesh of hovered function node
let selectedNodeId = null;      // nodeId with active call chain highlight

// Analytics overlays
let churnHeatEnabled = false;
let isChurnLoading = false;
let churnByNodeId = {};
let blameByNodeId = {};
let blameEnabled = false;
let isBlameLoading = false;

// Landmarks / tour
let landmarkTourTimer = null;
const landmarks = [];           // array of nodeId strings
const collapsedFolders = new Set();

// Fly-to animation
const flyTarget = { active: false, from: null, to: null, progress: 0, durationFrames: 55 };

// Intent search lexicon
const intentLexicon = {
    auth: ['auth', 'login', 'token', 'session', 'jwt', 'oauth', 'password'],
    payments: ['payment', 'billing', 'stripe', 'invoice', 'checkout', 'refund'],
    onboarding: ['onboarding', 'signup', 'welcome', 'invite'],
    notifications: ['notify', 'notification', 'email', 'sms', 'push'],
    api: ['api', 'route', 'controller', 'endpoint', 'handler'],
    data: ['db', 'database', 'model', 'schema', 'entity', 'repository'],
};

// Call chain highlight
const activeCallChain = {
    nodeId: null,
    nodeIds: new Set(),
    outboundEdgeIndices: new Set(),
    inboundEdgeIndices: new Set(),
};

// Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0); // always (0,0) = crosshair center

// IDE editors
const IDE_EDITORS = [
    { id: 'vscode',   label: 'VS Code',  icon: '🟦', scheme: 'vscode://file/{path}:{line}' },
    { id: 'cursor',   label: 'Cursor',   icon: '⚫', scheme: 'cursor://file/{path}:{line}' },
    { id: 'windsurf', label: 'Windsurf', icon: '🌊', scheme: 'windsurf://file/{path}:{line}' },
    { id: 'zed',      label: 'Zed',      icon: '⚡', scheme: 'zed://file/{path}:{line}' },
];

// Page visibility
let pageVisible = true;

// Reusable Three.js objects (avoid GC in hot loops)
const _tmpColor = new THREE.Color();
const _tmpVec3 = new THREE.Vector3();

// Pre-computed adjacency for O(1) edge lookup
const adjacencyIn = {};      // nodeId -> inbound edge count
const adjacencyOut = {};     // nodeId -> outbound edge count
const adjacencyInList = {};  // nodeId -> [sourceNodeId, ...]
const adjacencyOutList = {}; // nodeId -> [targetNodeId, ...]
const edgesByNode = {};      // nodeId -> [edgeIndex, ...]
const edgesByPair = {};      // "from->to" -> edgeIndex

// Function expansion
const expandedNodes = new Set();
const functionMeshes = new Map(); // nodeId -> [{ mesh: THREE.Mesh, line: THREE.Line }, ...]

// Multiplayer
let ws = null;
let myPlayerId = null;
let myNickname = 'Explorer';
let wsReconnectDelay = 1000;
const remotePlayers = new Map(); // connId -> { group, nickname, color, label }
const myColor = `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`;

// Auth
const AUTH_STORAGE_KEY = 'codechat_auth_v1';
let authState = { provider: null, token: null, userLabel: null };
let githubDeviceFlow = { deviceCode: null, userCode: null, verificationUri: null, intervalSec: null, expiresInSec: null };
let gitlabPkce = { verifier: null, state: null };

// Layout constants
const SPREAD = 12;
const LAYER_HEIGHT = 30;

// File layout mode (V key)
let fileLayoutMode = false;

// Layout mode (new)
const LAYOUT_MODES = ['cluster', 'galaxy', 'filesystem'];
let layoutModeIndex = 0;
let layoutMode = 'cluster';

// Search
let searchIndex = [];

// Frame counter
let frameCount = 0;
```

---

## 2. GRAPH DATA STRUCTURE

`graphData` shape (returned by all three generators):

```javascript
{
  nodes: [{
    id: 'src/auth/login.js',      // unique — relative file path
    label: 'login.js',            // filename only
    folder: 'src',                // first path segment; '_root' for top-level files
    lines: 142,
    fullPath: 'src/auth/login.js',
    definitions: [
      { name: 'loginUser', line: 14, kind: 'function' },
      { name: 'AuthError', line: 3,  kind: 'class' },
      { name: 'MAX_RETRIES', line: 1, kind: 'variable' },
    ],
    lang: 'javascript',
    preview: ['const express = require(\'express\');', '...'],
    size: 4096,
  }],
  edges: [{ from: 'src/auth/login.js', to: 'src/db/user.js' }],
  meta: {
    languages: { javascript: 42, typescript: 18 },
    unsupportedExtensions: ['.graphql'],
    totalFiles: 60,
    generatedAt: '2026-02-21T22:00:00.000Z',
    repo: 'owner/repo',   // folder name for local repos
    branch: 'main',       // 'local' for local repos
    provider: 'github',   // 'github' | 'gitlab' | 'local'
  },
}
```

Rules:
- `node.id === node.fullPath` for remote repos
- `node.folder` is always the first path segment or `'_root'`
- `definitions` is always an array, never null
- `edges` reference `node.id` values

---

## 3. LOCAL FOLDER LOADING

### 3.1 Start Screen Addition (index.html)

Add a third `<div class="start-section">` after the PRIVATE REPO section:

```html
<div class="start-section">
  <div class="start-section-label">💻 LOCAL REPO — <span>pick a folder from your machine</span></div>
  <button class="local-folder-btn" onclick="loadLocalFolder()">📂 Open Local Folder</button>
  <div style="color:#555;font-size:11px;margin-top:6px;font-family:'Courier New',monospace;">
    Chrome/Edge only. Files never leave your machine.
  </div>
</div>
```

CSS (add to `<style>` block):
```css
.local-folder-btn {
  width: 480px; padding: 14px 20px; font-size: 15px;
  font-family: 'Courier New', monospace; font-weight: bold;
  border-radius: 10px; cursor: pointer; border: 1px solid #333;
  background: rgba(255,255,255,0.04); color: #ccc;
  transition: filter 0.15s, transform 0.1s;
  letter-spacing: 0.5px; text-align: left;
}
.local-folder-btn:hover { filter: brightness(1.2); transform: scale(1.01); }
```

### 3.2 `window.loadLocalFolder` (explorer.js — near `window.loadAndStart`)

```javascript
window.loadLocalFolder = async function() {
  if (!window.showDirectoryPicker) {
    showLoadError('Your browser does not support local folder access. Use Chrome or Edge.');
    return;
  }

  let dirHandle;
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'read' });
  } catch (err) {
    if (err.name === 'AbortError') return;
    throw new Error(`Failed to open folder picker: ${err.message}`);
  }

  const btn = document.getElementById('startBtn');
  if (!btn) throw new Error('startBtn element missing from DOM');
  btn.disabled = true;
  showLoading(true);

  try {
    const data = await generateGraphFromLocalFolder(dirHandle, (msg) => {
      btn.textContent = msg;
    });

    if (!data) throw new Error('generateGraphFromLocalFolder returned no data');

    graphData = data;
    myNickname = dirHandle.name;
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
    btn.textContent = 'FLY IN';
    showLoading(false);
  }
};
```

### 3.3 `generateGraphFromLocalFolder` (graph-generator.js — after `generateGraphFromGitLab`)

```javascript
async function generateGraphFromLocalFolder(dirHandle, onProgress) {
  if (!dirHandle) throw new Error('generateGraphFromLocalFolder: dirHandle is required');

  const files = [];

  async function walk(handle, pathPrefix) {
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === 'directory') {
        if (EXCLUDED_DIRS.has(name) || name.startsWith('.')) continue;
        await walk(entry, pathPrefix ? `${pathPrefix}/${name}` : name);
      } else {
        const fullPath = pathPrefix ? `${pathPrefix}/${name}` : name;
        const ext = name.includes('.') ? '.' + name.split('.').pop().toLowerCase() : '';
        if (BINARY_EXTENSIONS.has(ext)) continue;
        if (EXCLUDED_FILES.has(name)) continue;
        const lang = LANG_CONFIG[ext] || FILENAME_LANG[name] || null;
        if (!lang) continue;
        files.push({ handle: entry, path: fullPath, lang, name });
      }
    }
  }

  if (onProgress) onProgress('Scanning folder...');
  await walk(dirHandle, '');

  if (files.length === 0) {
    throw new Error('No supported source files found. Pick the root of a code project.');
  }

  if (onProgress) onProgress(`Found ${files.length} files. Analyzing...`);

  const fileSet = new Set(files.map((f) => f.path));
  const nodes = [];
  const edges = [];
  const langStats = {};

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (onProgress && i % 20 === 0) onProgress(`Analyzing ${i + 1}/${files.length} files...`);

    let content;
    try {
      const fileObj = await file.handle.getFile();
      content = await fileObj.text();
    } catch { continue; }

    const lang = file.lang;
    langStats[lang] = (langStats[lang] || 0) + 1;
    const parts = file.path.split('/');
    const folder = parts.length > 1 ? parts[0] : '_root';
    const allLines = content.split('\n');
    const previewLines = allLines.filter((l) => l.trim().length > 0).slice(0, 8)
      .map((l) => l.length > 120 ? l.substring(0, 120) + '...' : l);
    const definitions = extractDefinitions(content, lang);
    const imports = extractImports(content, lang);

    nodes.push({
      id: file.path, label: parts[parts.length - 1], folder,
      lines: allLines.length, fullPath: file.path,
      definitions, lang, preview: previewLines, size: content.length,
    });

    for (const imp of imports) {
      const resolved = resolveImport(imp, file.path, fileSet, lang);
      if (resolved) edges.push({ from: file.path, to: resolved });
    }
  }

  if (nodes.length === 0) throw new Error('Could not read any files from the selected folder.');

  return {
    nodes, edges,
    meta: {
      languages: langStats, unsupportedExtensions: [], totalFiles: files.length,
      generatedAt: new Date().toISOString(),
      repo: dirHandle.name, branch: 'local', provider: 'local',
    },
  };
}
```

### 3.4 IDE Picker Fix for Local Repos

In `openIdePicker(node, line)` in `explorer.js`, fix the `isRemote` check:
```javascript
// WRONG (current):
const isRemote = !!(graphData && graphData.meta && graphData.meta.provider);

// CORRECT:
const isRemote = !!(graphData && graphData.meta && graphData.meta.provider
  && graphData.meta.provider !== 'local');
```

For local repos, show IDE buttons (VS Code, Cursor, etc.) with a note that the path is relative.

### 3.5 Multiplayer Guard for Local Repos

In `connectMultiplayer()`, add at the top before any WebSocket logic:
```javascript
if (graphData.meta.provider === 'local') {
  document.getElementById('onlineCount').textContent = '1';
  return;
}
```

---

## 4. LAYOUT MODES

### 4.1 `layoutGalaxy(nodes, edges)` — add to explorer.js after `layoutGraph()`

Golden ratio spiral. Most-connected files at center. Deterministic Y (no Math.random).

```javascript
function layoutGalaxy(nodes, edges) {
  const connCount = {};
  for (const edge of edges) {
    connCount[edge.from] = (connCount[edge.from] || 0) + 1;
    connCount[edge.to] = (connCount[edge.to] || 0) + 1;
  }
  const sorted = [...nodes].sort((a, b) => (connCount[b.id] || 0) - (connCount[a.id] || 0));
  const positions = {};
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < sorted.length; i++) {
    const r = Math.sqrt(i + 1) * 9;
    const theta = i * goldenAngle;
    positions[sorted[i].id] = {
      x: Math.cos(theta) * r,
      y: Math.sin(i * 0.3) * 8,
      z: Math.sin(theta) * r,
    };
  }
  return positions;
}
```

### 4.2 `layoutFilesystem(nodes)` — add after `layoutGalaxy()`

Folder columns on X axis, files stacked vertically by name within each column.

```javascript
function layoutFilesystem(nodes) {
  const byFolder = {};
  for (const node of nodes) {
    if (!byFolder[node.folder]) byFolder[node.folder] = [];
    byFolder[node.folder].push(node);
  }
  const positions = {};
  const folders = Object.keys(byFolder).sort();
  const COL_SPACING = 28;
  const ROW_SPACING = 4.5;
  const totalWidth = (folders.length - 1) * COL_SPACING;
  folders.forEach((folder, fi) => {
    const files = byFolder[folder].sort((a, b) => a.label.localeCompare(b.label));
    const colX = fi * COL_SPACING - totalWidth / 2;
    const colHeight = (files.length - 1) * ROW_SPACING;
    files.forEach((node, ni) => {
      positions[node.id] = { x: colX, y: colHeight / 2 - ni * ROW_SPACING, z: 0 };
    });
  });
  return positions;
}
```

### 4.3 `rebuildEdges(positions)` — add after `layoutFilesystem()`

```javascript
function rebuildEdges(positions) {
  for (const line of edgeLines) {
    scene.remove(line);
    line.geometry.dispose();
    line.material.dispose();
  }
  edgeLines.length = 0;
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x1a3a5a, transparent: true, opacity: 0.25 });
  for (const edge of graphData.edges) {
    const fromPos = positions[edge.from];
    const toPos = positions[edge.to];
    if (!fromPos || !toPos) continue;
    const points = [new THREE.Vector3(fromPos.x, fromPos.y, fromPos.z), new THREE.Vector3(toPos.x, toPos.y, toPos.z)];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geo, edgeMaterial.clone());
    line.userData = { from: edge.from, to: edge.to };
    scene.add(line);
    edgeLines.push(line);
  }
}
```

### 4.4 `rebuildGraphLayout()` — add after `rebuildEdges()`

```javascript
function rebuildGraphLayout() {
  let positions;
  if (layoutMode === 'cluster') {
    positions = layoutGraph(graphData.nodes, graphData.edges).positions;
  } else if (layoutMode === 'galaxy') {
    positions = layoutGalaxy(graphData.nodes, graphData.edges);
  } else if (layoutMode === 'filesystem') {
    positions = layoutFilesystem(graphData.nodes);
  } else {
    throw new Error(`rebuildGraphLayout: unknown layoutMode "${layoutMode}"`);
  }
  for (const nodeId of [...expandedNodes]) collapseFunctions(nodeId);
  for (const node of graphData.nodes) {
    const mesh = nodeMeshes.get(node.id);
    const pos = positions[node.id];
    if (!mesh || !pos) continue;
    mesh.userData.targetPos = new THREE.Vector3(pos.x, pos.y, pos.z);
    mesh.userData.baseY = pos.y;
  }
  rebuildEdges(positions);
}
```

### 4.5 `window.cycleLayoutMode()` — add after `rebuildGraphLayout()`

```javascript
window.cycleLayoutMode = function() {
  layoutModeIndex = (layoutModeIndex + 1) % LAYOUT_MODES.length;
  layoutMode = LAYOUT_MODES[layoutModeIndex];
  rebuildGraphLayout();
  const btn = document.getElementById('layoutModeBtn');
  if (btn) btn.textContent = `Layout: ${layoutMode.toUpperCase()} [L]`;
  const stats = document.getElementById('graphStats');
  if (stats) {
    const prev = stats.textContent;
    stats.textContent = `Switched to ${layoutMode} layout`;
    setTimeout(() => { stats.textContent = prev; }, 2000);
  }
};
```

### 4.6 Animate Loop Changes

In `animate()`, replace the existing node bobbing block:
```javascript
// BEFORE:
const time = Date.now() * 0.001;
for (const [id, mesh] of nodeMeshes) {
  mesh.position.y = mesh.userData.baseY + Math.sin(time + mesh.position.x * 0.1) * 0.3;
}

// AFTER (add lerp + guard bobbing while animating):
const time = Date.now() * 0.001;
for (const [id, mesh] of nodeMeshes) {
  if (mesh.userData.targetPos) {
    mesh.position.lerp(mesh.userData.targetPos, 0.08);
    if (mesh.position.distanceTo(mesh.userData.targetPos) < 0.05) {
      mesh.position.copy(mesh.userData.targetPos);
      delete mesh.userData.targetPos;
    }
  } else {
    mesh.position.y = mesh.userData.baseY + Math.sin(time + mesh.position.x * 0.1) * 0.3;
  }
}
```

### 4.7 HUD Button (index.html — inside `#hud`)

Add after the existing stat lines:
```html
<div id="layoutModeBtn"
     onclick="cycleLayoutMode()"
     style="cursor:pointer;color:#ff0;margin-top:6px;font-size:11px;user-select:none;">
  Layout: CLUSTER [L]
</div>
```

### 4.8 Keyboard Shortcut

In `setupControls()` keydown handler, add:
```javascript
if (key === 'l' && gameStarted && !e.shiftKey) {
  // L without shift = cycle layout (was: add landmark)
  window.cycleLayoutMode();
}
if (key === 'l' && gameStarted && e.shiftKey) {
  // Shift+L = add landmark (moved from plain L)
  if (hoveredNode) addLandmark(hoveredNode);
}
```

Update the controls hint in `#hud`:
```html
<div><span class="key">L</span> Layout | <span class="key">Shift+L</span> Landmark</div>
```
