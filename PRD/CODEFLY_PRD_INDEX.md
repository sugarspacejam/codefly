# CodeFly PRD — Master Index
**Version:** 1.0 | **Date:** February 2026 | **For:** Codex automated implementation agent

---

## How to Use This PRD

This PRD is split into 4 files. Read them in order. Every section references exact function names, variable names, line numbers, and file paths. Do not invent names — use exactly what is specified.

| File | Sections | What it covers |
|------|----------|----------------|
| `CODEFLY_PRD_part1.md` | §0–§4 | Product overview, all global state variables, graph data structure, local folder loading (File System Access API), layout modes (galaxy, filesystem, cluster) |
| `CODEFLY_PRD_part2.md` | §5–§7 | Folder appearance customization (color, shape, collapse, localStorage), Cloudflare Durable Objects multiplayer (full protocol + client code), GitHub/GitLab authentication (Device Flow, PKCE, PAT fallback) |
| `CODEFLY_PRD_part3.md` | §8–§24 | 3D scene init, graph building, function expansion, hover detection, controls (full key map), call chain highlight, animate loop, minimap, analytics filters, search (Ctrl+K), IDE picker, chat, player list, landmarks, text sprites, legend |
| `CODEFLY_PRD_part4.md` | §25–§31 | Graph generator internals (all constants, all regex patterns, all API functions), HUD HTML, full DOM element inventory, utility functions, window globals, CSS conventions, future features, implementation checklist |

---

## Absolute File Paths

```
/Volumes/waffleman/chentoledano/Projects-new/code-explorer/
├── index.html                    ← single HTML file, all CSS inline
├── explorer.js                   ← 3D engine, UI, multiplayer client (~2861 lines)
├── graph-generator.js            ← graph builder (GitHub, GitLab, local folder)
├── multiplayer/
│   ├── wrangler.toml             ← Cloudflare Worker config
│   └── src/
│       ├── index.js              ← Worker entry point (routes to Room DO)
│       └── room.js               ← Room Durable Object (WebSocket sessions)
└── PRD/
    ├── CODEFLY_PRD_INDEX.md      ← this file
    ├── CODEFLY_PRD_part1.md      ← §0–§4
    ├── CODEFLY_PRD_part2.md      ← §5–§7
    ├── CODEFLY_PRD_part3.md      ← §8–§24
    └── CODEFLY_PRD_part4.md      ← §25–§31
```

---

## Mandatory Coding Rules (apply to every line of code written)

1. **Fail fast** — no `||` fallbacks, no silent failures. If something is missing, `throw new Error(...)`.
2. **Single source of truth** — one property name per concept, everywhere.
3. **No optional chaining with fallbacks** — `?.` is for safe access only, never combined with `||`.
4. **No hardcoded logic where AI can decide** — no regex-based intent detection beyond what already exists.
5. **Explicit error messages** — every `throw` must say what failed and why.
6. **No magic default values** — if a config value is required, throw if missing.
7. **Imports at top of file** — never add `import` or `require` in the middle of a file.

---

## Implementation Order (from Part 4 §31)

Do these in sequence. Each item is self-contained and testable:

1. `generateGraphFromLocalFolder` in `graph-generator.js`
2. `window.loadLocalFolder` in `explorer.js`
3. Local folder button in `index.html` start screen
4. Fix `isRemote` check in `openIdePicker` for local repos
5. `layoutGalaxy` in `explorer.js`
6. `layoutFilesystem` in `explorer.js`
7. `rebuildEdges` in `explorer.js`
8. `rebuildGraphLayout` in `explorer.js`
9. `window.cycleLayoutMode` in `explorer.js`
10. Animate loop changes (lerp + bobbing guard)
11. `#layoutModeBtn` in `index.html` HUD
12. Keyboard shortcut `L` → `cycleLayoutMode`, `Shift+L` → landmark
13. `FOLDER_PREFS_KEY` + `getFolderPrefs` + `saveFolderPref` in `explorer.js`
14. `setFolderColor` + `setFolderShape` in `explorer.js`
15. Apply saved prefs in `buildGraph()`
16. `#folderSettingsPanel` + `#folderSettingsList` in `index.html`
17. `openFolderSettings` + `window.closeFolderSettings` in `explorer.js`
18. Keyboard shortcut `P` → toggle folder settings
19. Multiplayer guard for local repos in `connectMultiplayer()`
20. Update `#layoutModeBtn` text in `window.cycleLayoutMode`

---

## Key Invariants (never violate these)

- `graphData.nodes[i].id === graphData.nodes[i].fullPath` for remote repos
- `graphData.nodes[i].folder` is always the first path segment or `'_root'`
- `graphData.nodes[i].definitions` is always an array, never null/undefined
- `nodeMeshes` Map keys are `node.id` strings
- `edgeLines[i].userData.from` and `.to` are `node.id` strings
- `functionMeshes` Map keys are `node.id` strings, values are `[{ mesh, line }]`
- `expandedNodes` Set contains `node.id` strings
- `remotePlayers` Map keys are connection ID strings from the Durable Object
- `myColor` is set once at startup as `hsl(N, 80%, 60%)` and never changes
- `SPREAD = 12`, `LAYER_HEIGHT = 30` — layout constants, never change
- `mouse` is always `new THREE.Vector2(0, 0)` — raycasting always uses crosshair center
- `playerGroup` contains `camera` as a child — never add camera directly to scene
