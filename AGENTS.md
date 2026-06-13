# AGENTS.md

## Current mission

Prepare CodeFly for a non-embarrassing public beta release.

Postpone release by **10 working days** and ship a smaller, stable product:

```text
CodeFly is a browser-based 3D codebase explorer for quickly understanding unfamiliar repositories.
```

Codex must optimize for product truth, runtime stability, clean code, and one authoritative path per concern.

## Product promise

Ship CodeFly as:

- a visual codebase understanding tool
- a browser-first 3D repo explorer
- a way to inspect files, dependencies, definitions, and static execution paths

Do not position CodeFly as:

- a chat app
- an AI assistant
- a full collaboration platform
- a runtime tracing tool
- a complete analytics suite

## Release ownership rules

- **Authoritative product state:** generated graph data.
- **Authoritative execution-path contract:** `graphData.symbolEdges`.
- **Primary app owner:** `index.html`, `explorer.js`, and `graph-generator.js`.
- **Static/CLI graph owner:** `generate-graph.js`.
- **Deployment owner:** static/browser release first.
- **Runtime/config owner:** user browser owns local folder access, tokens, graph state, and UI state.
- **Multiplayer owner:** optional presence only; it must never block solo exploration.

Reject parallel paths:

- duplicate graph schemas
- chat-first positioning
- execution-path inference outside `symbolEdges`
- required multiplayer for solo exploration
- separate manual demo-only code paths
- duplicate deployment paths

## Clean code rules Codex cannot break

These rules apply to all production code changes.

- **Function hard limit:** 30 lines maximum.
- **Preferred function size:** 5-20 lines.
- **File preferred max:** 200 lines.
- **File hard warning:** 300 lines.
- **Tests exception:** test files may be longer, but each test case must read as a clear story.
- **Entry functions:** must read as a pipeline/story.
- **No inline algorithms in orchestration:** orchestration functions call named helpers instead of embedding logic.
- **Single responsibility:** each function should do one thing at one level of abstraction.
- **No boolean maze:** if a function needs many flags, split it into named functions.
- **No hidden global mutation:** mutation of shared state must be isolated in clearly named functions.
- **No duplicate logic:** extract repeated behavior after the second real use.
- **No speculative abstractions:** do not add frameworks, generic layers, registries, or factories without a current verified need.
- **No mixed ownership:** UI renders and handles interaction; graph generation extracts graph data.
- **No silent failures:** user-facing operations must either succeed or show a recoverable error.
- **No swallowed errors in critical paths:** catch only where the app can recover or show a meaningful message.
- **No magic strings for shared contracts:** centralize repeated event names, graph field names, and storage keys when touched.
- **No large anonymous callbacks:** move non-trivial callbacks into named functions.
- **No nested control-flow pyramids:** prefer early returns and small guard functions.
- **No direct DOM sprawl in business logic:** keep DOM updates in focused rendering/update helpers.
- **No network logic inside rendering helpers:** fetch/IO belongs in loading/service helpers.
- **No parser drift:** browser graph generation and CLI graph generation must emit compatible schemas.
- **No release-copy overpromises:** copy must match verified behavior.
- **No broken backward compatibility for old graphs:** old graph payloads without `symbolEdges` must still load.
- **No unrelated cleanup:** only change code required by the current release task.

## Required verification discipline

Before changing code, Codex must identify:

- the user-visible failure or release risk
- the exact local path that owns it
- the higher-level ownership or lifecycle cause
- where the critical state lives
- who creates it
- who reads it
- who destroys or resets it
- what happens if that owner fails

Prefer the smallest fix at the highest verified layer:

1. broken ownership/lifecycle/contract
2. broken service boundary
3. broken local mechanism
4. logs
5. wording

Do not patch symptoms if the ownership problem is visible.

## Launch feature contract

Headline features:

- public GitHub/GitLab repo loading
- local folder loading
- 3D file/dependency graph
- file/function/class search
- static execution paths from `graphData.symbolEdges`
- basic dependency insights
- open file in GitHub/GitLab/local IDE where supported

Secondary or beta:

- private repo token/OAuth flows
- multiplayer presence
- chat, only if already stable and non-blocking

Do not launch-market:

- persistent team chat
- guided tours
- QR sharing
- churn heatmap
- blame overlay
- advanced analytics platform claims

## Static execution-path architecture

This work remains required for the public beta, but it is part of release hardening, not a separate mission.

### Non-negotiable contract

- `symbolEdges` is the authoritative source for static execution paths.
- `edges` remains file-level and continues to power layout, dependency lines, filters, blast radius, and file lanes.
- `explorer.js` consumes `graphData.symbolEdges` for path search and execution panels.
- `explorer.js` may fall back to file-level `edges` only when `symbolEdges` is missing or empty.
- Do not implement runtime call stacks.
- Do not create fake 3D function nodes unless already supported by existing function orbit UI.

### Required graph schema

Generated graph objects must include:

```js
{
  nodes: [...],
  edges: [...],
  symbolEdges: [...],
  meta: {...}
}
```

Each symbol edge should use this shape:

```js
{
  fromFile: 'src/a.js',
  toFile: 'src/b.js',
  fromSymbol: 'handleLogin',
  toSymbol: 'exchangeToken',
  fromKind: 'function',
  toKind: 'function',
  fromLine: 42,
  toLine: 12,
  callLine: 51,
  type: 'static-call'
}
```

### Extraction rules

- Use existing node `definitions`.
- Match only references whose target symbol exists in graph definitions.
- Resolve same-file references.
- Resolve cross-file references only through imported files.
- Do not guess across unrelated files.
- For ambiguous names, emit only imported-file candidates.
- Attribute source symbol to the nearest containing definition with `def.line <= referenceLine`.
- Prefer function definitions as source.
- Skip edges when no source symbol exists.
- Avoid self-recursive edges unless intentionally added later.

## Day 1 — Freeze scope and remove misleading promises

Codex must:

- Update README/product copy to describe CodeFly as a visual codebase explorer.
- Remove or downgrade claims that imply persistent team chat or full collaboration.
- Mark private repo auth/token flows as beta unless verified end-to-end.
- Ensure launch copy does not promise runtime tracing.
- Ensure launch copy calls execution paths static/dependency-based.
- Identify dead, unstable, or confusing launch UI controls and either hide them or label them experimental.

Acceptance:

- README and visible app copy match the launch feature contract.
- No launch-facing text claims chat-first collaboration.
- No launch-facing text claims runtime call stacks.

## Day 2 — Simplify first-run UX

Codex must:

- Make the start screen explain one primary action: paste a repo URL or choose a local folder.
- Ensure public repo loading and local folder loading are visually prioritized over auth.
- Ensure unsupported browser/local-folder states show clear errors.
- Ensure loading copy tells users what is happening.
- Ensure errors leave the user on a recoverable start screen.

Acceptance:

- A new user can understand what to do in under 10 seconds.
- Failed load does not leave the app stuck.
- Auth is not required for the primary demo path.

## Day 3 — Stabilize public repo loading

Codex must:

- Verify public GitHub repo loading.
- Verify public GitLab repo loading.
- Fix graph generation failures that break normal public repos.
- Ensure unsupported files become nodes instead of crashing.
- Ensure invalid repo URLs show actionable errors.

Acceptance:

- One small GitHub repo loads.
- One medium GitHub repo loads.
- One public GitLab repo loads.
- Console has no uncaught app-breaking errors in the normal path.

## Day 4 — Stabilize local folder loading

Codex must:

- Verify local folder loading in a browser that supports `showDirectoryPicker`.
- Ensure local file content is not uploaded to any server.
- Ensure denied folder permissions preserve the start screen.
- Ensure empty folders and unsupported-heavy folders do not crash.
- Ensure local graph output includes the same schema as browser repo loading.

Acceptance:

- Local folder load renders a graph.
- Denied access shows a clear message.
- Local loading remains browser-owned.

## Day 5 — Finish static execution paths

Codex must:

- Complete `symbolEdges` generation in `graph-generator.js`.
- Complete matching schema in `generate-graph.js`.
- Ensure `explorer.js` consumes `graphData.symbolEdges`.
- Keep file-level edge fallback only for old/missing graph payloads.
- Ensure execution path rows show symbol names and line numbers.
- Ensure clicking a path highlights source and target file nodes.

Acceptance:

- `graphData.symbolEdges` exists for newly generated graphs.
- Symbol edges contain real `fromSymbol` and `toSymbol` values.
- Execution panel shows `CALLS` and `CALLED BY` when symbol data exists.
- Older graphs without `symbolEdges` still work.

## Day 6 — Make search useful

Codex must:

- Verify `Cmd+K` / `Ctrl+K` opens and closes cleanly.
- Ensure search indexes files, functions, classes, and symbol paths.
- Ensure path queries like `path auth`, `calls token`, and symbol names return useful results.
- Ensure clicking search results flies to the correct file node.
- Ensure empty search states are not broken or confusing.

Acceptance:

- Search is usable as the main navigation tool.
- Symbol-level path results appear when `symbolEdges` exists.
- Clicking results does not hide or corrupt graph state.

## Day 7 — Trim analytics to reliable dependency insights

Codex must:

- Keep only reliable dependency insights visible for launch.
- Verify orphan files, hub files, and blast radius.
- Hide or remove launch emphasis from unstable advanced analytics.
- Ensure analytics failures do not break graph navigation.

Acceptance:

- Basic insights work on a loaded repo.
- Unstable lenses are not marketed as launch features.
- Analytics panel can be opened and closed without trapping pointer/input state.

## Day 8 — Multiplayer must not hurt solo mode

Codex must:

- Ensure WebSocket failures do not block loading or exploring a repo.
- Ensure remote presence errors do not crash rendering.
- Ensure chat is hidden, secondary, or clearly experimental if not fully verified.
- Ensure solo mode is the default reliable experience.
- Remove any copy that makes multiplayer required for value.

Acceptance:

- App works fully with multiplayer unavailable.
- Multiplayer failure is non-fatal.
- Chat is not positioned as the reason to use the app.

## Day 9 — Release QA pass

Codex must test these repos/inputs:

- one small JavaScript repo
- one medium mixed-language repo
- this CodeFly repo itself
- one local folder
- one invalid repo URL
- one unsupported-heavy folder/repo

Codex must verify:

- no stuck loading state
- no uncaught crash during normal navigation
- search opens, returns results, and navigates
- node click opens useful panels
- execution paths show symbol rows when available
- load errors are human-readable
- pointer lock can be escaped
- app remains usable without multiplayer

Acceptance:

- Every critical launch path either succeeds or fails gracefully.
- No known embarrassing bug remains in headline features.

## Day 10 — Ship public beta

Codex must:

- Run syntax checks:

```bash
node --check graph-generator.js
node --check generate-graph.js
node --check explorer.js
node --check server.js
```

- Run the app locally with `npm start`.
- Verify the golden demo path.
- Update README with public beta positioning.
- Commit the finished release-hardening work.

Suggested final release commit:

```bash
git commit -m "Prepare CodeFly public beta release"
```

## Final release bar

Ship only if:

- public repo exploration works
- local folder exploration works
- search is reliable
- static execution paths are truthful
- unsupported files do not crash the app
- solo mode works without multiplayer
- copy does not overpromise chat, runtime tracing, or full collaboration

If any of those fail, do not ship.
