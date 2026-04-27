# CodeFly — PRD Part 4: Graph Generator Internals, HUD, Future Features
**Version:** 1.0 | **Date:** February 2026 | **Agent:** Codex implementation target

---

## 25. GRAPH GENERATOR — `graph-generator.js` (full internals)

### 25.1 Constants

```javascript
const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  'coverage', '__pycache__', '.pytest_cache', 'venv', '.venv', 'env',
  '.env', 'vendor', 'target', 'bin', 'obj', '.idea', '.vscode',
  '.gradle', 'Pods', 'DerivedData', 'tmp', 'temp', 'logs', 'log',
  '.cache', 'public', 'static', 'assets', 'images', 'fonts', 'icons',
  'media', 'uploads', 'downloads',
]);

const EXCLUDED_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Gemfile.lock',
  'Cargo.lock', 'poetry.lock', 'composer.lock', '.gitignore',
  '.gitattributes', '.editorconfig', '.prettierrc', '.eslintrc',
  '.eslintignore', '.babelrc', 'tsconfig.json', 'jest.config.js',
  'webpack.config.js', 'vite.config.js', 'rollup.config.js',
]);

const LANG_CONFIG = {
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.jsx': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript',
  '.py': 'python', '.go': 'go', '.java': 'java', '.rs': 'rust',
  '.cs': 'csharp', '.rb': 'ruby', '.php': 'php', '.swift': 'swift',
  '.kt': 'kotlin', '.kts': 'kotlin', '.scala': 'scala',
  '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp',
  '.html': 'html', '.htm': 'html', '.css': 'css', '.scss': 'css', '.sass': 'css', '.less': 'css',
  '.vue': 'vue', '.svelte': 'svelte', '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  '.sql': 'sql', '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
  '.md': 'markdown', '.mdx': 'markdown', '.xml': 'xml', '.toml': 'toml',
  '.env': 'env', '.dockerfile': 'docker',
};

const FILENAME_LANG = {
  'Dockerfile': 'docker', 'Makefile': 'shell', 'Rakefile': 'ruby',
  'Gemfile': 'ruby', 'Procfile': 'shell', '.env': 'env',
  '.env.local': 'env', '.env.example': 'env',
};

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp', '.tiff',
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z', '.exe', '.dll', '.so',
  '.dylib', '.wasm', '.ttf', '.woff', '.woff2', '.eot', '.otf',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.webm',
  '.db', '.sqlite', '.lock', '.bin', '.dat', '.class', '.pyc',
]);
```

### 25.2 URL Parsers

```javascript
function parseGitHubUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/?\s#]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

function parseGitLabUrl(url) {
  const match = url.match(/gitlab\.com\/(.+?)(?:\.git)?(?:[/?#]|$)/);
  if (!match) return null;
  const parts = match[1].split('/');
  if (parts.length < 2) return null;
  return { namespace: parts.slice(0, -1).join('/'), project: parts[parts.length - 1] };
}
```

### 25.3 GitHub API Functions

**`fetchGitHubTree(owner, repo, token)`** — fetches default branch + full recursive tree. Returns `{ tree, branch, headers }`.

**`fetchFileContent(owner, repo, filePath, headers)`** — GET `/contents/{path}`, decodes base64. Returns text or `null`.

**`fetchLastCommitDate(owner, repo, filePath, headers)`** — GET `/commits?path={path}&per_page=1`. Returns ISO date string or `null`.

**`fetchCommitDatesForRepo(repoFull, token, files, onProgress)`** — sequential commit date fetch per file. Returns `{ [filePath]: isoDate }`.

**`fetchBlameForRepo(repoFull, token, files, onProgress)`** — fetches last commit author per file. Returns `{ [filePath]: { author, email, date } }`.

### 25.4 GitLab API Functions

**`fetchGitLabProject(namespace, project, token)`** — GET `/api/v4/projects/{encoded}`. Returns `{ defaultBranch, pathWithNamespace, headers }`.

**`fetchGitLabTree(projectId, branch, headers)`** — paginated GET with `recursive=true`, follows `x-next-page` header. Returns flat array.

**`fetchGitLabFileRaw(projectId, branch, filePath, headers)`** — GET `/repository/files/{encoded}/raw?ref={branch}`. Returns text or `null`.

### 25.5 `filterTree(tree)` (graph-generator.js ~line 238)

- Skip non-blob items, items in `EXCLUDED_DIRS`, items in `EXCLUDED_FILES`
- Map extension → language via `LANG_CONFIG` or `FILENAME_LANG`
- Returns `{ files: [{ path, size, lang }], skippedExts: Set }`

### 25.6 `extractImports(content, lang)` — returns `Set<string>`

Language-specific regex patterns for import detection:

| Language | Patterns |
|----------|----------|
| javascript | `require('...')`, `import ... from '...'`, `import '...'` |
| typescript | Same as JS |
| python | `import X`, `from X import` |
| go | `"package/path"` inside import blocks |
| java | `import pkg.Class` |
| rust | `use crate::module` |
| csharp | `using Namespace` |
| ruby | `require '...'`, `require_relative '...'` |
| php | `use/include/require '...'` |
| swift/kotlin/scala | `import Module` |
| c/cpp | `#include "file.h"` (angle brackets skipped) |
| html | `<script src>`, `<link href>` |
| css | `@import url(...)` |
| vue/svelte | `import ... from '...'` |
| shell | `source file`, `. file` |
| sql/json/yaml/xml/toml/env/docker | empty — no imports |

### 25.7 `extractDefinitions(content, lang)` — returns `[{ name, line, kind }]`

`SKIP_KEYWORDS` = `{ if, else, for, while, switch, catch, return, new, throw, typeof, delete, void, try, finally, do, break, continue, case, default, with }`

Deduplication via `seen = new Set()`. Line number = `content.substring(0, match.index).split('\n').length`.

| Language | function | class | variable |
|----------|----------|-------|----------|
| javascript | `function name(`, `const name = () =>`, `exports.name =` | `class Name` | `const/let/var name =` (non-arrow) |
| typescript | `export function name`, arrow functions | `class/interface/enum Name` | `export type Name` |
| python | `def name(`, `async def name(` | `class Name` | `UPPER_CASE =` |
| go | `func name(`, `func (recv) name(` | `type Name struct/interface` | — |
| java | method signatures | `class/interface Name` | — |
| rust | `fn name(`, `pub fn name(` | `struct/enum/trait Name` | — |
| csharp | method signatures | `class Name` | — |
| ruby | `def name`, `def self.name` | `class/module Name` | — |
| php | `function name(` | `class Name` | — |
| swift | `func name(` | `class/struct/protocol/enum Name` | — |
| kotlin | `fun name(` | `class Name` | — |
| scala | `def name` | `class/case class/trait/object Name` | — |
| c | return-type `name(` | `struct Name` | `#define UPPER` |
| cpp | return-type `name(` | `class/struct/namespace Name` | — |
| html | `function name(` | — | `id="name"` |
| css | `@keyframes name` | `.className {` | `--var-name:` |
| vue/svelte | `function name(`, `const name =` | — | `const/let/var name =` |
| shell | `name() {` | — | `UPPER=` |
| sql | `CREATE TABLE name`, `CREATE FUNCTION name` | — | — |
| markdown | `# Heading` | — | — |
| yaml | `key:` | — | — |
| toml | `[section]` | — | — |
| env | `KEY=` | — | — |
| docker | `FROM/RUN/CMD/ENTRYPOINT/...` | — | — |

### 25.8 `resolveImport(importPath, fromFile, fileSet, lang)` (graph-generator.js ~line 456)

Returns resolved file path string or `null`.

- **python:** converts `.` to `/`, tries `path.py`, `path/__init__.py`, relative variants
- **javascript/typescript:** only relative paths (`.` or `/`). Tries: `''`, `.ts`, `.tsx`, `.js`, `.jsx`, `/index.ts`, `/index.tsx`, `/index.js`
- **ruby:** only relative paths, tries `.rb`
- **c/cpp:** only local includes (not `<angle brackets>`)
- **html/css/vue/svelte:** skips `http://`, `https://`, `//`; resolves relative paths
- **all others:** returns `null`

**`normalizePath(p)`** — resolves `..` and `.` segments.

---

## 26. HUD ELEMENTS (index.html)

### `#hud` (top-right overlay)
```html
<div id="hud" style="display:none; position:fixed; top:16px; right:16px; z-index:10;
     font-family:'Courier New',monospace; font-size:11px; color:#0f8;
     background:rgba(0,0,0,0.6); border:1px solid #0f8; border-radius:8px;
     padding:10px 14px; line-height:1.8; min-width:200px;">
  <div style="font-size:13px; font-weight:bold; margin-bottom:4px; letter-spacing:1px;">CODEFLY</div>
  <div id="graphStats"></div>
  <div>Nodes: <span id="hudNodes">0</span> | Edges: <span id="hudEdges">0</span></div>
  <div>Defs: <span id="hudFunctions">0</span></div>
  <div>Pos: <span id="hudPos">0, 0, 0</span></div>
  <div>Speed: <span id="hudSpeed">1x</span></div>
  <div>Online: <span id="onlineCount">1</span></div>
  <div id="layoutModeBtn" onclick="cycleLayoutMode()"
       style="cursor:pointer;color:#ff0;margin-top:6px;font-size:11px;user-select:none;">
    Layout: CLUSTER [L]
  </div>
  <div style="margin-top:8px;color:#555;font-size:10px;line-height:1.6;">
    <div><span class="key">WASD</span> Move | <span class="key">F</span> Fly/Walk</div>
    <div><span class="key">Shift</span> Boost | <span class="key">C</span> Camera</div>
    <div><span class="key">Click</span> Expand | <span class="key">O</span> Open IDE</div>
    <div><span class="key">G</span> Analytics | <span class="key">Ctrl+K</span> Search</div>
    <div><span class="key">L</span> Layout | <span class="key">Shift+L</span> Landmark</div>
    <div><span class="key">V</span> Orbit/Stack | <span class="key">P</span> Folder styles</div>
    <div><span class="key">Tab</span> Players | <span class="key">Enter</span> Chat</div>
  </div>
</div>
```

---

## 27. FULL DOM ELEMENT INVENTORY (index.html)

| ID | Purpose |
|----|---------|
| `startScreen` | Landing screen |
| `repoInput` | URL input |
| `startBtn` | "FLY IN" button |
| `loadError` | Error message |
| `recentRepos` | Last 5 repos |
| `authBlock` | Login buttons |
| `authStatus` | Auth state text |
| `logoutBtn` | Sign out |
| `nicknameInput` | Player nickname |
| `hud` | Top-right HUD |
| `graphStats` | File/dep/lang counts |
| `hudNodes` | Node count |
| `hudEdges` | Edge count |
| `hudFunctions` | Total defs count |
| `hudPos` | Player XYZ |
| `hudSpeed` | Speed multiplier |
| `onlineCount` | Online players |
| `layoutModeBtn` | Layout cycle button ← NEW |
| `crosshair` | Center `+` |
| `loadingOverlay` | Full-screen loader |
| `loadingText` | Loading status |
| `hoverTooltip` | Top-center hover info |
| `previewCard` | File preview (hidden) |
| `functionPanel` | Expanded function list |
| `functionFileName` | File path in panel |
| `functionCount` | Def count |
| `functionList` | Def items |
| `legend` | Folder color legend |
| `legendItems` | Legend items |
| `minimap` | 200×200 canvas |
| `chatBox` | Chat container |
| `chatMessages` | Message history |
| `chatInput` | Chat input |
| `playerList` | Player list panel |
| `playerListItems` | Player items |
| `analyticsPanel` | Analytics panel |
| `analyticsResults` | Filter results |
| `langFilters` | Language buttons |
| `folderFilters` | Folder buttons |
| `searchOverlay` | Ctrl+K overlay |
| `searchInput` | Search input |
| `searchResults` | Search results |
| `idePickerModal` | IDE picker modal |
| `idePickerPath` | File path display |
| `idePickerButtons` | IDE buttons |
| `deviceFlowModal` | GitHub Device Flow |
| `deviceFlowCode` | User code display |
| `patModal` | PAT fallback modal |
| `patModalTitle` | Modal title |
| `patModalInput` | Token input |
| `patModalLink` | Create token link |
| `patModalError` | Error message |
| `folderSettingsPanel` | Folder appearance ← NEW |
| `folderSettingsList` | Folder rows ← NEW |
| `limitationsBanner` | Truncation warning |
| `contactBtn` | Feedback button |
| `contactModal` | Contact modal |

---

## 28. UTILITY FUNCTIONS (explorer.js)

**`escapeHtml(str)`** — escapes `&`, `<`, `>`, `"` for safe DOM insertion.

**`showLoadError(msg)` / `hideLoadError()`** — shows/hides `#loadError`.

**`showLoading(bool)`** — shows/hides `#loadingOverlay`.

**`showLimitations(meta)`** — shows `#limitationsBanner` if `unsupportedExtensions.length > 0` or `totalFiles > 500`.

**`hslToHex(hslStr)`** — converts `"hsl(200, 80%, 60%)"` to Three.js hex integer via `THREE.Color.setHSL()`.

**`createTextSprite(text, color, fontSize)`** — creates `THREE.Sprite` with canvas texture. Canvas 512×128, font `bold {fontSize}px 'Courier New'`, text centered. Used for node labels and player name tags.

**`saveRecentRepo(url)`** — saves to `localStorage['codefly_recent_repos']`, max 5 entries.

**`loadRecentRepos()`** — populates `#recentRepos` with clickable buttons.

---

## 29. WINDOW GLOBALS (index.html)

```javascript
window.CODECHAT_OAUTH = {
  githubClientId: '',
  gitlabClientId: '',
  gitlabRedirectUri: window.location.origin + window.location.pathname,
};
window.CODEFLY_MULTIPLAYER_HOST = '';
```

---

## 30. FUTURE FEATURES

### 30.1 Copy-Paste Functions in 3D View
Right-click function node → context menu → "Copy function body" / "Copy import statement". Clipboard only — no file writes (browser security model).

### 30.2 Import Connection Drawing
Hold `I` + drag from file A to file B → shows generated import statement in a modal with copy button. Visual dashed line (temporary, not saved).

### 30.3 Galaxy Layout Enhancements
- 4 spiral arms (one per major folder group)
- Very slow galaxy rotation (`0.00001` rad/frame)
- Particle nebula clouds around folder clusters

### 30.4 Filesystem Layout Enhancements
- 3D folder column headers as large text
- Z-axis depth for sub-folder nesting
- Slide-in animation when switching modes

### 30.5 QR Tour Sharing
`showTourQr()` — generates QR code for tour URL using pure-JS QR library from CDN. Modal with "Copy link" + "Download QR".

### 30.6 Multiplayer Enhancements
- **Pointer sharing:** other users see colored indicator on your hovered node
- **Follow mode:** click player name → camera follows them
- **Reaction emotes:** number keys 1–5 emit floating emoji above avatar
- **Voice proximity:** WebRTC spatial audio (louder when closer)

### 30.7 AI-Powered Features
- **Intent search via LLM:** send query + file list to LLM, get best-matching file
- **Function summary tooltips:** 1-line AI summary on function node hover
- **Dependency explanation:** click edge → LLM explains why A imports B

### 30.8 Performance Optimizations
- **LOD:** distant nodes use `SphereGeometry(size, 4, 4)` instead of `(size, 16, 16)`
- **Edge instancing:** `InstancedMesh` for repos with >500 edges
- **Worker thread parsing:** move `extractDefinitions` + `extractImports` to a Web Worker to avoid blocking the main thread during graph generation
- **Incremental loading:** show graph as files load instead of waiting for all files

---

## 31. IMPLEMENTATION CHECKLIST FOR CODEX AGENT

In order of priority:

1. **`generateGraphFromLocalFolder`** in `graph-generator.js` — add after `generateGraphFromGitLab`
2. **`window.loadLocalFolder`** in `explorer.js` — add near `window.loadAndStart`
3. **Local folder button** in `index.html` start screen
4. **Fix `isRemote` check** in `openIdePicker` for local repos
5. **`layoutGalaxy`** in `explorer.js` — add after `layoutGraph`
6. **`layoutFilesystem`** in `explorer.js` — add after `layoutGalaxy`
7. **`rebuildEdges`** in `explorer.js` — add after `layoutFilesystem`
8. **`rebuildGraphLayout`** in `explorer.js` — add after `rebuildEdges`
9. **`window.cycleLayoutMode`** in `explorer.js` — add after `rebuildGraphLayout`
10. **Animate loop changes** — add lerp block + guard bobbing while `targetPos` set
11. **`#layoutModeBtn`** in `index.html` HUD
12. **Keyboard shortcut `L`** → `cycleLayoutMode`, `Shift+L` → landmark
13. **`FOLDER_PREFS_KEY` + `getFolderPrefs` + `saveFolderPref`** in `explorer.js`
14. **`setFolderColor` + `setFolderShape`** in `explorer.js`
15. **Apply saved prefs in `buildGraph()`**
16. **`#folderSettingsPanel` + `#folderSettingsList`** in `index.html`
17. **`openFolderSettings` + `window.closeFolderSettings`** in `explorer.js`
18. **Keyboard shortcut `P`** → toggle folder settings
19. **Multiplayer guard** for local repos in `connectMultiplayer()`
20. **Update `#layoutModeBtn` text** in `window.cycleLayoutMode`
