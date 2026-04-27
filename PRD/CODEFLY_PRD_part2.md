# CodeFly — PRD Part 2: Folder Appearance, Multiplayer, Authentication
**Version:** 1.0 | **Date:** February 2026 | **Agent:** Codex implementation target

---

## 5. FOLDER APPEARANCE CUSTOMIZATION

### 5.1 Concept

Each folder is currently assigned a color deterministically via `getFolderColor(folder)` (hash-based, returns a hex integer). Users should be able to:
- Change the color of any folder (color picker)
- Change the visual shape of nodes within a folder (sphere, cube, diamond, cylinder)
- Hide/show all files in a folder (collapse/expand)
- These preferences persist in `localStorage` under key `'codefly_folder_prefs_v1'`

### 5.2 Folder Preferences Storage (explorer.js)

Add these four functions. Place them near the analytics section (around line 1800):

```javascript
const FOLDER_PREFS_KEY = 'codefly_folder_prefs_v1';

function getFolderPrefs(folder) {
  try {
    const all = JSON.parse(localStorage.getItem(FOLDER_PREFS_KEY) || '{}');
    return all[folder] || {};
  } catch {
    return {};
  }
}

function saveFolderPref(folder, key, value) {
  try {
    const all = JSON.parse(localStorage.getItem(FOLDER_PREFS_KEY) || '{}');
    if (!all[folder]) all[folder] = {};
    all[folder][key] = value;
    localStorage.setItem(FOLDER_PREFS_KEY, JSON.stringify(all));
  } catch {
    throw new Error(`Failed to save folder preference for "${folder}"`);
  }
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
    // Update glow child
    for (const child of mesh.children) {
      if (child.isMesh && child.material && child.material.transparent) {
        child.material.color.setHex(colorInt);
      }
    }
  }
}

function setFolderShape(folder, shape) {
  const VALID_SHAPES = ['sphere', 'cube', 'diamond', 'cylinder'];
  if (!VALID_SHAPES.includes(shape)) {
    throw new Error(`setFolderShape: invalid shape "${shape}". Must be one of: ${VALID_SHAPES.join(', ')}`);
  }
  saveFolderPref(folder, 'shape', shape);

  for (const [id, mesh] of nodeMeshes) {
    if (!mesh.userData.nodeData) continue;
    if (mesh.userData.nodeData.folder !== folder) continue;

    const size = mesh.userData.baseSize;
    let newGeo;
    if (shape === 'sphere')   newGeo = new THREE.SphereGeometry(size, 16, 16);
    else if (shape === 'cube')     newGeo = new THREE.BoxGeometry(size * 1.5, size * 1.5, size * 1.5);
    else if (shape === 'diamond')  newGeo = new THREE.OctahedronGeometry(size * 1.2, 0);
    else if (shape === 'cylinder') newGeo = new THREE.CylinderGeometry(size * 0.8, size * 0.8, size * 2, 12);

    mesh.geometry.dispose();
    mesh.geometry = newGeo;
  }
}
```

### 5.3 Apply Saved Prefs on Graph Build

In `buildGraph()` in `explorer.js`, after `nodeMeshes.set(node.id, mesh)` and after the glow/label/indicator children are added, apply saved preferences:

```javascript
// Apply saved folder preferences (color, shape)
const savedPrefs = getFolderPrefs(node.folder);
if (savedPrefs.color) {
  const colorInt = parseInt(savedPrefs.color.replace('#', ''), 16);
  mat.color.setHex(colorInt);
  mat.emissive.setHex(colorInt);
  mesh.userData.baseColor = colorInt;
}
if (savedPrefs.shape && savedPrefs.shape !== 'sphere') {
  // Defer shape change until after mesh is in scene
  setTimeout(() => setFolderShape(node.folder, savedPrefs.shape), 0);
}
```

**Note:** The `setTimeout` is needed because `setFolderShape` iterates `nodeMeshes` — calling it mid-loop would only affect already-added meshes. Using `setTimeout(fn, 0)` defers until after `buildGraph()` completes. This is the correct approach.

### 5.4 Folder Settings Panel (index.html)

Add this HTML element inside `<body>`, after `#analyticsPanel`:

```html
<div id="folderSettingsPanel"
     style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
            background:#0a0a1a; border:1px solid #333; border-radius:12px; padding:24px;
            z-index:200; min-width:380px; max-height:80vh; overflow-y:auto;
            font-family:'Courier New',monospace; box-shadow:0 0 40px rgba(0,0,0,0.8);">
  <div style="color:#fff; font-size:15px; font-weight:bold; margin-bottom:16px; letter-spacing:1px;">
    📁 FOLDER APPEARANCE
  </div>
  <div id="folderSettingsList"></div>
  <button onclick="closeFolderSettings()"
          style="margin-top:16px; padding:8px 20px; background:transparent; color:#555;
                 border:1px solid #333; border-radius:6px; cursor:pointer;
                 font-family:'Courier New',monospace; font-size:12px;">
    Close
  </button>
</div>
```

### 5.5 `openFolderSettings()` and `closeFolderSettings()` (explorer.js)

```javascript
function openFolderSettings() {
  if (!gameStarted) throw new Error('openFolderSettings: game not started');
  if (!graphData) throw new Error('openFolderSettings: no graph data loaded');

  const panel = document.getElementById('folderSettingsPanel');
  const list = document.getElementById('folderSettingsList');
  if (!panel || !list) throw new Error('Folder settings panel elements missing from DOM');

  const folders = [...new Set(graphData.nodes.map((n) => n.folder))].sort();
  list.innerHTML = '';

  for (const folder of folders) {
    const prefs = getFolderPrefs(folder);
    const defaultColorHex = '#' + getFolderColor(folder).toString(16).padStart(6, '0');
    const nodeCount = graphData.nodes.filter((n) => n.folder === folder).length;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; gap:10px; margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid #111;';

    // Folder name + file count
    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'color:#ccc; font-size:12px; width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex-shrink:0;';
    nameEl.textContent = `${folder} (${nodeCount})`;
    nameEl.title = folder;

    // Color picker
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = prefs.color || defaultColorHex;
    colorInput.style.cssText = 'width:32px; height:26px; border:none; cursor:pointer; border-radius:4px; flex-shrink:0;';
    colorInput.title = 'Change folder color';
    colorInput.oninput = () => setFolderColor(folder, colorInput.value);

    // Shape selector
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

    // Hide/Show toggle
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
  if (!panel) throw new Error('folderSettingsPanel element missing from DOM');
  panel.style.display = 'none';
};
```

### 5.6 Keyboard Shortcut

In `setupControls()` keydown handler, add:
```javascript
if (key === 'p' && gameStarted) {
  const panel = document.getElementById('folderSettingsPanel');
  if (panel.style.display === 'block') {
    window.closeFolderSettings();
  } else {
    openFolderSettings();
  }
}
```

Update controls hint in `#hud`:
```html
<div><span class="key">P</span> Folder styles | <span class="key">V</span> Orbit/Stack</div>
```

---

## 6. MULTIPLAYER — CLOUDFLARE DURABLE OBJECTS

### 6.1 Architecture Overview

Each unique repo URL becomes a **Durable Object instance** (a persistent WebSocket room). When two users load the same GitHub repo, they connect to the same Durable Object and see each other in real-time.

The Cloudflare Worker lives in `/multiplayer/` and is deployed separately from the main app.

### 6.2 Cloudflare Worker Files (already written — do not recreate)

**`multiplayer/wrangler.toml`:**
```toml
name = "codefly-multiplayer"
main = "src/index.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[[durable_objects.bindings]]
name = "ROOMS"
class_name = "Room"

[[migrations]]
tag = "v1"
new_classes = ["Room"]
```

**`multiplayer/src/index.js`:** Worker entry point. Routes `GET /room/:roomId` (WebSocket upgrade) to a Room Durable Object. Returns CORS headers for OPTIONS preflight. Returns a 200 text response for any other path.

**`multiplayer/src/room.js`:** Room Durable Object. Stores sessions in `Map<connId, { ws, presence }>`. Handles:
- `presence` message → updates stored presence, broadcasts `presence_snapshot` to all other connections
- `chat` message → broadcasts to all connections
- WebSocket close → removes session, broadcasts `leave`

### 6.3 WebSocket Message Protocol

**Client → Server:**
```json
{ "type": "presence", "x": 12.4, "y": 5.1, "z": -33.2, "yaw": 1.2, "nickname": "chen", "color": "hsl(200,80%,60%)", "nodeId": "src/auth.js" }
{ "type": "chat", "text": "look at this file", "nickname": "chen", "color": "hsl(200,80%,60%)" }
```

**Server → Client:**
```json
{ "type": "presence_snapshot", "users": [{ "id": "uuid", "x": 12.4, "y": 5.1, "z": -33.2, "yaw": 1.2, "nickname": "chen", "color": "hsl(200,80%,60%)", "nodeId": "src/auth.js" }] }
{ "type": "chat", "id": "uuid", "nickname": "chen", "color": "hsl(200,80%,60%)", "text": "look at this file", "ts": 1234567890 }
{ "type": "leave", "id": "uuid" }
```

### 6.4 `connectMultiplayer()` — full implementation (explorer.js)

This replaces the old implementation that used a local WebSocket server via `<meta name="ws-port">`. The new version connects to the Cloudflare Worker.

```javascript
// Set this to your deployed Cloudflare Worker URL after `wrangler deploy`
// e.g. 'https://codefly-multiplayer.yourname.workers.dev'
// Set in index.html as: window.CODEFLY_MULTIPLAYER_HOST = '...'
const MULTIPLAYER_HOST = window.CODEFLY_MULTIPLAYER_HOST || '';

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
    sendPositionUpdate(); // announce ourselves immediately
  };

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return; // ignore malformed messages
    }

    if (msg.type === 'presence_snapshot') {
      if (!Array.isArray(msg.users)) return;

      const incomingIds = new Set(msg.users.map((u) => u.id));

      // Remove players who are no longer in the snapshot
      for (const [id] of remotePlayers) {
        if (!incomingIds.has(id)) {
          removeRemotePlayer(id);
        }
      }

      // Add or update players
      for (const user of msg.users) {
        if (!user.id || !user.nickname) continue;
        if (user.id === myPlayerId) continue; // skip ourselves

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
      if (!msg.nickname || !msg.text) return;
      addChatMessage(`${msg.nickname}: ${msg.text}`, '#8ff');
    }

    if (msg.type === 'leave') {
      if (!msg.id) return;
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

  ws.onerror = () => {}; // onclose will fire after onerror, handles reconnect
}
```

### 6.5 `sendPositionUpdate()` — updated implementation (explorer.js)

Called every 3 frames from `animate()`. Sends current position, yaw, nickname, color, and hovered node ID.

```javascript
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
```

### 6.6 `sendChat(text)` — updated implementation (explorer.js)

```javascript
function sendChat(text) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    type: 'chat',
    text,
    nickname: myNickname,
    color: myColor,
  }));
  addChatMessage(`${myNickname}: ${text}`, '#0f8');
}
```

### 6.7 Remote Player Rendering

`createRemotePlayer(data)` creates a `THREE.Group` with:
- **Body:** `CapsuleGeometry(0.3, 0.8, 4, 8)` in player color, `MeshPhongMaterial` with `emissiveIntensity: 0.3`
- **Head:** `SphereGeometry(0.35, 12, 12)` white with color emissive, `emissiveIntensity: 0.2`
- **Glow:** `SphereGeometry(1.2, 8, 8)` transparent `opacity: 0.08` in player color
- **Label:** `createTextSprite(nickname, color, 24)` at `y=2.5`, `scale.set(4, 2, 1)`

`data.color` is an HSL string like `"hsl(200,80%,60%)"`. `hslToHex(hslStr)` converts it to a Three.js hex integer.

`updateRemotePlayer(playerId, position, rotation, nickname)`:
- Lerps `group.position` toward `{x,y,z}` with factor `0.15`
- Slerps `group.quaternion` toward yaw quaternion with factor `0.15`
- If nickname changed, calls `updateRemotePlayerLabel(playerId)`

`removeRemotePlayer(playerId)`:
- Calls `addChatMessage(`${rp.nickname} left`, '#f88')`
- Calls `scene.remove(rp.group)`
- Deletes from `remotePlayers` Map

`updateOnlineCount()`:
- Sets `#onlineCount` to `remotePlayers.size + 1`
- Rebuilds `#playerListItems` with one div per player (you + all remote)

### 6.8 Minimap: Remote Players

In `updateMinimap()`, remote players are drawn as magenta dots:
```javascript
for (const [id, rp] of remotePlayers) {
  const rpx = (rp.group.position.x - px) * scale;
  const rpz = (rp.group.position.z - pz) * scale;
  ctx.fillStyle = '#f0f';
  ctx.beginPath();
  ctx.arc(cx + rpx, cy + rpz, 3, 0, Math.PI * 2);
  ctx.fill();
}
```

### 6.9 Config in index.html

```javascript
window.CODEFLY_MULTIPLAYER_HOST = ''; // set to Worker URL after deploy
```

### 6.10 Deployment Steps

```bash
cd /path/to/code-explorer/multiplayer
npx wrangler@latest login    # opens browser to authenticate with Cloudflare
npx wrangler@latest deploy   # deploys, prints Worker URL
```

After deploy, set `window.CODEFLY_MULTIPLAYER_HOST` in `index.html` to the printed URL.

---

## 7. AUTHENTICATION

### 7.1 Config Block (index.html)

```javascript
window.CODECHAT_OAUTH = {
  githubClientId: '',    // GitHub OAuth App Client ID (Device Flow)
  gitlabClientId: '',    // GitLab OAuth App Application ID (PKCE)
  gitlabRedirectUri: window.location.origin + window.location.pathname,
};
window.CODEFLY_MULTIPLAYER_HOST = '';
```

### 7.2 Auth State (explorer.js)

```javascript
const AUTH_STORAGE_KEY = 'codechat_auth_v1';
let authState = { provider: null, token: null, userLabel: null };
```

**`loadAuthState()`** — called on page load. Reads from `localStorage.getItem(AUTH_STORAGE_KEY)`. Parses JSON. If parse fails, sets `authState` to `{ provider: null, token: null, userLabel: null }`. Calls `updateAuthUi()`.

**`saveAuthState()`** — writes `JSON.stringify(authState)` to `localStorage.setItem(AUTH_STORAGE_KEY, ...)`. Calls `updateAuthUi()`.

**`updateAuthUi()`** — updates `#authStatus` text and CSS class:
- If `!authState.provider || !authState.token`: text = `'Not connected — public repos work without login'`, class = `'logged-out'`, hide `#logoutBtn`
- Else: text = `'🐙 Connected as [userLabel]'` (GitHub) or `'🦊 Connected as [userLabel]'` (GitLab), class = `'logged-in'`, show `#logoutBtn`

**`getGitHubTokenForApi()`** — returns `authState.token` if `authState.provider === 'github'`, else `null`.

**`getGitLabTokenForApi()`** — returns `authState.token` if `authState.provider === 'gitlab'`, else `null`.

**`window.logoutAuth()`** — sets `authState = { provider: null, token: null, userLabel: null }`, calls `saveAuthState()`.

### 7.3 `getOAuthConfig()` (explorer.js)

```javascript
function getOAuthConfig() {
  const cfg = window.CODECHAT_OAUTH;
  if (!cfg) {
    return {
      githubClientId: '',
      gitlabClientId: '',
      gitlabRedirectUri: window.location.origin + window.location.pathname,
    };
  }
  return cfg;
}
```

### 7.4 GitHub Device Flow

**`window.loginGitHub()`:**
1. Call `getOAuthConfig()` → get `githubClientId`
2. If `!githubClientId` → call `openPatModal('github')` and return
3. POST `https://github.com/login/device/code` with body `client_id=...&scope=repo,read:user`, header `Accept: application/json`
4. Parse response: `{ device_code, user_code, verification_uri, interval, expires_in }`
5. Store in `githubDeviceFlow = { deviceCode, userCode, verificationUri, intervalSec: interval, expiresInSec: expires_in }`
6. Show `#deviceFlowModal`: set `#deviceFlowCode` to `user_code`
7. Poll `https://github.com/login/oauth/access_token` every `interval` seconds with `client_id`, `device_code`, `grant_type=urn:ietf:params:oauth:grant-type:device_code`
8. If response contains `access_token`: call `fetchGitHubViewerLogin(token)` to get username, set `authState = { provider: 'github', token, userLabel: username }`, call `saveAuthState()`, close modal
9. If response contains `error: 'authorization_pending'` → continue polling
10. If response contains `error: 'expired_token'` → show error, stop polling

**`window.openDeviceFlowUrl()`** — opens `githubDeviceFlow.verificationUri` in new tab.

**`window.closeDeviceFlow()`** — hides `#deviceFlowModal`, stops polling.

**`fetchGitHubViewerLogin(token)`** — GraphQL query to `https://api.github.com/graphql`:
```graphql
{ viewer { login } }
```
Returns `login` string. Throws if response is not ok or `data.viewer.login` is missing.

### 7.5 GitLab PKCE Flow

**`window.loginGitLab()`:**
1. Call `getOAuthConfig()` → get `gitlabClientId`, `gitlabRedirectUri`
2. If `!gitlabClientId` → call `openPatModal('gitlab')` and return
3. Generate `verifier` = 64 random URL-safe chars
4. Generate `state` = 24 random URL-safe chars
5. Compute `challenge = base64url(sha256(verifier))`
6. Store `gitlabPkce = { verifier, state }`
7. Redirect to:
   ```
   https://gitlab.com/oauth/authorize
     ?client_id=...
     &redirect_uri=...
     &response_type=code
     &scope=read_api+read_repository
     &code_challenge=...
     &code_challenge_method=S256
     &state=...
   ```

**`completeGitLabOAuthFromUrl()`** — called on page load if URL contains `?code=...&state=...`:
1. Read `code` and `state` from `new URLSearchParams(window.location.search)`
2. Verify `state === gitlabPkce.state` (stored in `sessionStorage`)
3. POST to `https://gitlab.com/oauth/token` with `client_id`, `code`, `redirect_uri`, `grant_type=authorization_code`, `code_verifier`
4. Get `access_token` from response
5. GET `https://gitlab.com/api/v4/user` with `Authorization: Bearer [token]`
6. Get `username` from response
7. Set `authState = { provider: 'gitlab', token: access_token, userLabel: username }`, call `saveAuthState()`
8. Clean URL with `history.replaceState(null, '', window.location.pathname)`

**Helper functions:**
```javascript
function randomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => chars[b % chars.length]).join('');
}

async function sha256Base64Url(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
```

### 7.6 PAT Fallback Modal

When OAuth client IDs are not configured, clicking either login button opens `#patModal`.

**HTML (already in index.html):**
```html
<div id="patModal" style="display:none; ...">
  <div id="patModalTitle">Connect GitHub — Personal Access Token</div>
  <input id="patModalInput" type="password" placeholder="ghp_xxxx...">
  <a id="patModalLink" href="#" target="_blank">Create GitHub token ↗</a>
  <div id="patModalError" style="color:#f44; font-size:11px;"></div>
  <button onclick="savePatToken()">Connect</button>
  <button onclick="closePatModal()">Cancel</button>
</div>
```

**`openPatModal(provider)`:**
- Sets `modal.dataset.provider = provider`
- If `provider === 'github'`: title = `'Connect GitHub — Personal Access Token'`, placeholder = `'ghp_xxxx...'`, link href = `'https://github.com/settings/tokens/new?scopes=repo,read:user&description=CodeFly'`
- If `provider === 'gitlab'`: title = `'Connect GitLab — Personal Access Token'`, placeholder = `'glpat-xxxx...'`, link href = `'https://gitlab.com/-/user_settings/personal_access_tokens?name=CodeFly&scopes=read_api,read_repository'`
- Clears `#patModalInput` and `#patModalError`
- Sets `modal.style.display = 'block'`

**`window.closePatModal()`:** sets `modal.style.display = 'none'`

**`window.savePatToken()`:**
1. Read `provider` from `modal.dataset.provider`
2. Read `token` from `#patModalInput` value (trimmed)
3. If empty → set `#patModalError` text = `'Please enter a token'`, return
4. Set `#patModalError` text = `'Verifying…'`
5. If `provider === 'github'`: call `fetchGitHubViewerLogin(token)` → get `userLabel`
6. If `provider === 'gitlab'`: GET `https://gitlab.com/api/v4/user` with `Authorization: Bearer [token]` → get `data.username` as `userLabel`
7. Set `authState = { provider, token, userLabel }`, call `saveAuthState()`, call `window.closePatModal()`
8. On error: set `#patModalError` text = `err.message`
