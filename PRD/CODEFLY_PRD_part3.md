# CodeFly — PRD Part 3: 3D Scene, Controls, Analytics, Search, IDE Picker, Chat
**Version:** 1.0 | **Date:** February 2026 | **Agent:** Codex implementation target

---

## 8. 3D SCENE INITIALIZATION — `init()` (explorer.js ~line 648)

Called once after `graphData` is loaded.

- `scene = new THREE.Scene()`, background `0x050510`, fog `FogExp2(0x050510, 0.003)`
- `camera = PerspectiveCamera(75, aspect, 0.1, 2000)`
- `renderer = WebGLRenderer({ antialias: true })`, full window size, `pixelRatio = devicePixelRatio`, appended to `document.body`, `zIndex=0`
- Lights: `AmbientLight(0x222244, 0.6)` + `DirectionalLight(0xffffff, 0.4)` at `(50,100,50)`
- `playerGroup = new THREE.Group()` at `(0, 30, 80)`, camera added as child at local `(0, 2, 0)`
- Grid: `GridHelper(600, 60, 0x111133, 0x0a0a22)` at `y = groundLevel (-50)`
- Stars: 3000 random `Points` in ±750 range, `PointsMaterial(0x444466, size=0.8)`
- Calls: `buildAdjacency()`, `buildGraph()`, `nodeMeshArray = Array.from(nodeMeshes.values())`, `updateRaycastTargets()`, `hydrateLandmarks()`, `importTourFromUrl()`, `renderLandmarks()`, `setupControls()`, `buildLegend()`, `animate()`

---

## 9. GRAPH SCENE — `buildGraph()` (explorer.js ~line 721)

Calls `layoutGraph()` → `{ positions, folderPositions }`.

**Per node:**
- `size = Math.max(0.5, Math.min(2.5, Math.sqrt(node.lines) * 0.1))`
- `color = getFolderColor(node.folder)` (deterministic hash → hex int)
- `SphereGeometry(size, 16, 16)` + `MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.3, shininess: 30 })`
- `mesh.userData = { nodeData: node, baseColor: color, baseSize: size, baseY: pos.y, isFileNode: true }`
- Glow child: `SphereGeometry(size*1.5, 12, 12)`, `MeshBasicMaterial(color, transparent, opacity=0.1)`
- Label child: `createTextSprite(node.label, color)` at `y=size+1.5`, `scale=(4,2,1)`
- If `definitions.length > 0`: orange ring `RingGeometry(size*1.2, size*1.5, 24)` at `y=-size*0.9`, opacity 0.5

**Per edge:**
- `LineBasicMaterial(0x1a3a5a, transparent, opacity=0.25)`
- `line.userData = { from: edge.from, to: edge.to }`
- Pushed to `edgeLines[]`

**Per folder pillar:**
- `CylinderGeometry(0.3, 0.3, LAYER_HEIGHT*2, 8)`, `MeshBasicMaterial(color, transparent, opacity=0.15)`
- Folder label sprite at `y = pos.y + LAYER_HEIGHT + 5`, `scale=(12,6,1)`

**`layoutGraph(nodes, edges)`** (explorer.js ~line 575):
- Groups nodes by folder. Places folders in a circle at radius `folderCount * SPREAD * 1.2`.
- Within each folder: spiral arrangement with random Y offsets in `±LAYER_HEIGHT/2`.
- 3 iterations of repulsion pass (min distance = `SPREAD * 1.5`, force = `(minDist - dist) * 0.3`).
- Returns `{ positions: {[nodeId]: {x,y,z}}, folderPositions: {[folder]: {x,y,z}} }`
- Constants: `SPREAD = 12`, `LAYER_HEIGHT = 30`

---

## 10. FUNCTION EXPANSION (explorer.js ~line 817)

### `expandFunctions(nodeId)`
- Creates `OctahedronGeometry(0.4, 0)` meshes for each definition
- Colors: function=`0xff8800`, class=`0x00ccff`, variable=`0xcc66ff`
- Orbit mode: placed at `cos/sin(angle) * orbitRadius` around parent
- File layout mode: stacked at `x=parent.x+4`, `y=parent.y + (count/2-i)*2.2`
- Each has a label sprite and a connection `Line` to parent
- `fnMesh.userData = { isFunctionNode, functionName, functionLine, functionKind, parentNodeId, orbitAngle, orbitRadius, orbitIndex, orbitCount, fileLayoutIndex, fileLayoutCount }`
- Calls `updateFunctionPanel(node)` to show `#functionPanel`

### `collapseFunctions(nodeId)`
- Removes all function meshes and lines from scene, disposes geometry/material
- Hides `#functionPanel`

### `updateFunctionOrbits()` — called every frame
- `time = Date.now() * 0.00008` (slow rotation)
- In orbit mode: `angle = orbitAngle + time`, Y bobs with `sin(time*0.4 + orbitIndex)*0.3`
- Updates connection line geometry positions every frame
- In file layout mode: positions are static (set at expand time), only line endpoints updated

### `updateFunctionPanel(node)`
- Shows `#functionPanel` with `node.fullPath` and list of definitions
- Each definition item: `[cls/fn/var] name :line`, clickable → `openIdePicker(node, def.line)`

---

## 11. HOVER DETECTION — `updateHover()` (explorer.js ~line 1666)

- `raycaster.setFromCamera(mouse=(0,0), camera)` — always crosshair center
- `intersects = raycaster.intersectObjects(raycastTargets, true)`
- `resolveHoverTarget(intersects)` — walks parent chain to find `isFileNode` or `isFunctionNode`
- On hover: `emissiveIntensity=0.8`, `scale=1.3` (file node), `scale=1.15` (function node)
- Shows `#hoverTooltip` (top-center, non-blocking) with: `fullPath`, `lines + size + lang`, `↑inbound ↓outbound`, `N defs — click to expand`
- If `!selectedNodeId`: calls `resetCallChainHighlight()` + `applyCallChainHighlight(hoveredNodeId)`

**`#hoverTooltip`** — fixed position, top-center, `pointer-events:none`, `z-index:20`

---

## 12. CONTROLS — `setupControls()` (explorer.js ~line 1453)

### Keyboard shortcuts (keydown)

| Key | Action |
|-----|--------|
| `f` | Toggle fly/walk mode |
| `c` | Toggle first/third person camera |
| `enter` | Toggle chat input |
| `tab` | Toggle `#playerList` |
| `g` | Toggle `#analyticsPanel` |
| `ctrl+k` | Toggle search overlay |
| `l` (no shift) | `cycleLayoutMode()` ← NEW |
| `shift+l` | Add hovered node as landmark ← MOVED |
| `b` | Blast radius for selected node |
| `o` | Open IDE picker for hovered node |
| `v` | Toggle `fileLayoutMode` (orbit ↔ stack) |
| `p` | Toggle folder settings panel ← NEW |
| `escape` | Close search, hide analytics |

### Mouse
- **Click canvas**: if not locked → request pointer lock; if locked → expand/collapse node or open IDE picker for function node
- **Mousemove**: update `playerYaw` and `playerPitch` (clamped to `±maxPitch`)
- **Wheel**: adjust `cameraDistance` (third-person only)

### `updateMovement()` (explorer.js ~line 1618)
- Flying: WASD = directional movement, Space = up, Ctrl = down, Shift = 4× boost
- Walking: WASD at 0.5× speed, Space = jump, gravity applies, clamped at `groundLevel+1`
- Updates `#hudPos` and `#hudSpeed` every frame

---

## 13. CALL CHAIN HIGHLIGHT (explorer.js ~line 953)

### `computeCallChain(nodeId, maxDepth=3)`
- BFS outbound via `adjacencyOutList` → `outboundEdgeIndices` (green)
- BFS inbound via `adjacencyInList` → `inboundEdgeIndices` (blue)
- Returns `{ nodeIds: Set, outboundEdgeIndices: Set, inboundEdgeIndices: Set }`

### `applyCallChainHighlight(nodeId)`
- Matching nodes: `emissiveIntensity=0.55`, `scale=1.15`
- Outbound edges: `opacity=0.9`, `color=0x00ff88` (green)
- Inbound edges: `opacity=0.85`, `color=0x5cc8ff` (blue)

### `resetCallChainHighlight()`
- Restores all highlighted nodes to `emissiveIntensity=0.3`, `scale=1`
- Restores all highlighted edges to `opacity=0.25`, `color=0x1a3a5a`

---

## 14. ANIMATE LOOP — `animate()` (explorer.js ~line 2349)

```javascript
function animate() {
  requestAnimationFrame(animate);
  frameCount++;
  if (gameStarted && pageVisible) {
    updateMovement();
    updateFlyTarget();
    updateHover();
    if (frameCount % 2 === 0) updateMinimap();
    updateFunctionOrbits();
    const time = Date.now() * 0.001;
    for (const [id, mesh] of nodeMeshes) {
      if (mesh.userData.targetPos) {
        // Layout transition animation
        mesh.position.lerp(mesh.userData.targetPos, 0.08);
        if (mesh.position.distanceTo(mesh.userData.targetPos) < 0.05) {
          mesh.position.copy(mesh.userData.targetPos);
          delete mesh.userData.targetPos;
        }
      } else {
        // Normal bobbing
        mesh.position.y = mesh.userData.baseY + Math.sin(time + mesh.position.x * 0.1) * 0.3;
      }
    }
    if (frameCount % 3 === 0) sendPositionUpdate();
  }
  renderer.render(scene, camera);
}
```

---

## 15. MINIMAP — `updateMinimap()` (explorer.js ~line 1730)

- 200×200 `<canvas id="minimap">`, fixed bottom-right, `display:none` until game starts
- Called every 2 frames
- Scale: `0.3` world units per pixel, centered on player position
- Draws: edges (dim blue lines), file nodes (2px colored dots), remote players (3px magenta), local player (4px green with glow + forward direction line 15px long)

---

## 16. ANALYTICS — `#analyticsPanel` (explorer.js ~line 1800)

Opened with `G` key. `buildAnalyticsFilters()` populates language and folder filter buttons.

**`highlightNodes(matchingIds, label)`:**
- Matching: `opacity=1, emissiveIntensity=0.8, scale=1.5`
- Non-matching: `opacity=0.08, emissiveIntensity=0.05, scale=0.5`
- Edges both-match: `opacity=0.8, color=0x00ff88`; one-match: `opacity=0.15`; no-match: `opacity=0.02`

**Filter functions:**
- `filterOrphans()` — no inbound AND no outbound edges
- `filterHubs()` — top 10% by total connections
- `filterLargest()` — top 20 by `node.lines`
- `filterCircular()` — nodes in cycles (DFS)
- `showBlastRadius()` — nodes reachable from `selectedNodeId` within 3 outbound hops
- `filterNoDefinitions()` — `definitions.length === 0`
- `filterApiSurface()` — `adjacencyIn >= 5`
- `filterHotPaths()` — `adjacencyIn + adjacencyOut >= 8`
- `filterRiskZones()` — `lines > 200 && adjacencyIn >= 3`
- `filterEntryPoints()` — top 10 by outbound count
- `toggleChurnHeat()` — fetches last commit dates via GitHub API, colors nodes by recency (red=recent, blue=old)
- `toggleBlameOverlay()` — fetches last author per file, shows name labels on nodes
- `filterByKind(kind)` — nodes with at least one definition of that kind
- `clearFilters()` — restores all nodes/edges to default

**Folder collapse** (also used by folder settings panel):
- `toggleFolderCollapse(folder)` — adds/removes from `collapsedFolders` Set, calls `applyFolderCollapse()`
- `applyFolderCollapse()` — sets `mesh.visible` and `line.visible` based on `collapsedFolders`

---

## 17. SEARCH — `#searchOverlay` (explorer.js ~line 2375)

Opened with `Ctrl+K`. Releases pointer lock.

**`buildSearchIndex()`** — builds flat array of `{ type, name, path, nodeId, line? }` for all files and definitions.

**`performSearch(query)`:**
- If `query.startsWith('?')`: intent search via `resolveIntentTarget()` — matches against `intentLexicon` categories, returns best-matching node
- Else: case-insensitive substring match on `name` and `path`, max 30 results
- Each result: `[FILE/FN/CLS/VAR] name path:line`, click → `flyToNode(nodeId)` + `closeSearch()`

**`resolveIntentTarget(query)`** — scores each node by how many `intentLexicon` keywords appear in its `fullPath`, returns highest-scoring node.

---

## 18. IDE PICKER — `openIdePicker(node, line)` (explorer.js ~line 2466)

```
if !node: throw Error('openIdePicker requires a node')
lineNumber = line || 1
isRemote = graphData.meta.provider && graphData.meta.provider !== 'local'

If isRemote (github or gitlab):
  Build remoteUrl:
    github: https://github.com/{repo}/blob/{branch}/{fullPath}#L{line}
    gitlab: https://gitlab.com/{repo}/-/blob/{branch}/{fullPath}#L{line}
  Add "🌐 View on GitHub/GitLab" button → opens remoteUrl in new tab
  Add "📋 Copy file path" button → copies fullPath to clipboard, shows "✅ Copied!"
  Add note: "To open in your local IDE, clone the repo first."

If local (provider === 'local') OR no provider:
  For each editor in IDE_EDITORS:
    Add button with editor.icon + editor.label
    onclick → openInEditor(editor, node, lineNumber)
  Add note: "Path is relative to the folder you opened."

modal.style.display = 'block'
document.exitPointerLock()
```

**`openInEditor(editor, node, lineNumber)`:**
```javascript
function openInEditor(editor, node, lineNumber) {
  if (!node.fullPath) throw new Error('Node has no fullPath for IDE open');
  const url = editor.scheme
    .replace('{path}', encodeURIComponent(node.fullPath))
    .replace('{line}', lineNumber);
  window.open(url, '_blank');
  closeIdePicker();
}
```

**IDE picker modal HTML:**
```html
<div id="idePickerModal" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#0a0a1a; border:1px solid #333; border-radius:12px; padding:24px; z-index:100; min-width:300px;">
  <div style="color:#fff; font-size:14px; font-weight:bold; margin-bottom:8px;">Open in editor</div>
  <div id="idePickerPath" style="color:#555; font-size:11px; margin-bottom:16px; word-break:break-all;"></div>
  <div id="idePickerButtons"></div>
  <button onclick="closeIdePicker()" style="margin-top:16px; ...">Cancel</button>
</div>
```

---

## 19. CHAT — `#chatBox` (explorer.js ~line 1380)

### HTML
```html
<div id="chatBox" style="display:none; position:fixed; bottom:20px; left:20px; width:320px; z-index:15;">
  <div id="chatMessages" style="max-height:150px; overflow-y:auto; ..."></div>
  <input type="text" id="chatInput" placeholder="Type message..." maxlength="200" autocomplete="off"
         style="display:none; width:100%; ...">
</div>
```

### `addChatMessage(text, color)` (explorer.js ~line 1380)
- Creates a `<div>` with `color` style and `escapeHtml(text)` content
- Appends to `#chatMessages`, scrolls to bottom
- Keeps max 50 messages (removes oldest if exceeded)

### `sendChat(text)` (explorer.js ~line 1398)
- If `ws.readyState !== WebSocket.OPEN`: return (no throw — multiplayer may be disabled)
- Sends `{ type: 'chat', text, nickname: myNickname, color: myColor }`
- Calls `addChatMessage(`${myNickname}: ${text}`, '#0f8')` locally

### Chat input behavior (in `setupControls()`):
- `Enter` key: opens chat input, releases pointer lock
- When chat input is focused, `Enter` sends message, hides input, re-requests pointer lock
- `Escape` in chat input: hides input without sending

---

## 20. PLAYER LIST — `#playerList` (explorer.js ~line 1344)

Toggled with `Tab` key.

**`updateOnlineCount()`:**
- Sets `#onlineCount` to `remotePlayers.size + 1`
- Rebuilds `#playerListItems`:
  - First item: `"${myNickname} (you)"` in green `#0f8`
  - One item per remote player in `#8ff`

---

## 21. LANDMARKS & TOUR (explorer.js)

### `addLandmark(node)` — called with `Shift+L`
- Pushes `node.id` to `landmarks[]`
- Calls `renderLandmarks()` to update `#landmarkList` in analytics panel
- Saves to `localStorage`

### `playLandmarkTour()`
- Flies to each landmark in sequence, 3 seconds apart
- Uses `flyToNode()` + `setInterval`

### `exportTourLink()`
- Encodes `landmarks[]` as base64 URL param `?tour=...`
- Copies to clipboard

### `showTourQr()`
- Generates QR code for the tour URL using a QR library or canvas-based implementation
- Shows in a modal

### `importTourFromUrl()`
- Called in `init()`. Reads `?tour=` param from URL, decodes, populates `landmarks[]`.

---

## 22. TEXT SPRITES — `createTextSprite(text, color, fontSize)` (explorer.js ~line 1407)

Creates a `THREE.Sprite` with a canvas texture containing the given text. Used for node labels and player name tags.

```javascript
function createTextSprite(text, color, fontSize) {
  fontSize = fontSize || 28;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
  ctx.fillStyle = typeof color === 'number'
    ? '#' + color.toString(16).padStart(6, '0')
    : color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  return new THREE.Sprite(mat);
}
```

---

## 23. LEGEND — `buildLegend()` (explorer.js)

Populates `#legendItems` in `#legend` panel with one colored dot + folder name per unique folder. Clicking a folder name calls `toggleFolderCollapse(folder)`.

---

## 24. RECENT REPOS (explorer.js)

`saveRecentRepo(url)` — saves to `localStorage` under `'codefly_recent_repos'`, max 5 entries.

`loadRecentRepos()` — called on page load, populates `#recentRepos` with clickable buttons that set `#repoInput` value and call `loadAndStart()`.
