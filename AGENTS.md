# AGENTS.md

## Mission

Implement real static execution-path support for CodeFly.

The current UI has an execution-path panel, but it is backed by file-level dependency edges. That is not enough. The correct fix is to move the feature to the graph-generation ownership layer and emit symbol-level static call/reference edges as authoritative graph data.

## Non-negotiable architecture

- **Authoritative state lives in graph data.**
  - Add a top-level `symbolEdges` array to generated graph output.
  - Do not infer symbol execution paths only inside `explorer.js`.

- **Graph generation owns extraction.**
  - `graph-generator.js` must emit `symbolEdges` for browser-generated GitHub, GitLab, and local-folder graphs.
  - `generate-graph.js` must emit the same schema for CLI/static generated graphs.

- **UI owns rendering and interaction only.**
  - `explorer.js` should consume `graphData.symbolEdges`.
  - It may fall back to file-level `edges` only if `symbolEdges` is missing or empty, for older graph payloads.

- **Do not implement runtime call stacks.**
  - This is static expected execution/dependency flow only.

- **Do not introduce parallel path systems.**
  - `symbolEdges` is the one authoritative contract for function/class/variable paths.
  - Do not add separate ad-hoc path caches as the source of truth.

## Current relevant files

- `graph-generator.js`
  - Browser-side graph generation.
  - Used by GitHub, GitLab, and local folder loading.
  - Currently creates file nodes with `definitions`, import sets, and file-level `edges`.

- `generate-graph.js`
  - CLI/static graph generator.
  - Must stay schema-compatible with `graph-generator.js`.

- `explorer.js`
  - 3D graph renderer, search, call-chain highlight, execution-path panel.
  - Recently added approximate execution-path UI using file-level `edges`.

- `index.html`
  - Contains search overlay and `#executionPathPanel`.

## Existing limitation to solve

The app currently uses file-level dependency edges like:

```js
{ from: 'src/a.js', to: 'src/b.js' }
```

The requested feature needs symbol-level static execution edges like:

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

## Required graph schema

Generated graph objects must become:

```js
{
  nodes: [...],
  edges: [...],
  symbolEdges: [...],
  meta: {...}
}
```

`edges` remains file-level and continues to power layout, dependency lines, filters, blast radius, etc.

`symbolEdges` powers execution paths, global path search, and path panel rows.

## Extraction rules

### Definitions

Use existing `definitions` already attached to nodes. Each definition has:

```js
{ name, line, kind }
```

Kinds include at least:

- `function`
- `class`
- `variable`

### Symbol references

Add a helper in both graph generators:

```js
function extractSymbolReferences(content, knownDefinitions) {
  // returns [{ name, line }]
}
```

The first implementation can be regex-based and conservative.

Rules:

- Match function/class usage by identifier name.
- For function calls, match `name(`.
- For class constructors/usages, match `new Name(` and plain `Name(` where applicable.
- Avoid matching language keywords.
- Avoid self-recursive edge from a function to itself unless explicitly wanted later.
- Include only references whose target symbol exists in graph definitions.

### Cross-file resolution

Build an index:

```js
Map<symbolName, Array<{ file, def }>>
```

Then resolve references:

- If the target symbol is in the same file, create same-file symbol edge.
- If the target symbol is in an imported file, create cross-file symbol edge.
- For ambiguous names across multiple imported files, emit edges only for imported-file candidates.
- Do not guess across unrelated files.

### Source symbol attribution

For each reference line, determine the nearest containing source symbol.

Minimum acceptable implementation:

- Sort definitions in a file by line.
- For a reference on line `N`, source symbol is the nearest definition with `def.line <= N`.
- Prefer `function` definitions as source.
- If no source symbol exists, skip the symbol edge.

This is much better than using the first function in a file.

## Implementation details

### In `graph-generator.js`

Add helpers near parser utilities:

- `escapeRegexLiteral(value)`
- `extractSymbolReferences(content, definitions)`
- `findContainingDefinition(definitions, line)`
- `buildSymbolEdges(nodes, importsByFile, refsByFile)`

During each graph generation flow:

- Keep `importsByFile = new Map()`.
- Keep `refsByFile = new Map()`.
- After `buildNodeFromContent(file, content)`, call `extractSymbolReferences(content, node.definitions)`.
- Resolve imports as today for file-level `edges`.
- Store the resolved imported files in `importsByFile`.
- After all nodes are built, call:

```js
const symbolEdges = buildSymbolEdges(nodes, importsByFile, refsByFile);
```

Return `symbolEdges` in GitHub, GitLab, and local-folder graph outputs.

### In `generate-graph.js`

Implement the exact same schema and helper behavior.

Do not let CLI output drift from browser output.

## UI changes in `explorer.js`

### Build path search index from `symbolEdges`

Update `buildPathSearchIndex()`:

- Prefer `graphData.symbolEdges` if present and non-empty.
- Convert each symbol edge to a search row:

```js
{
  type: 'path',
  name: `${fromSymbol} → ${toSymbol}`,
  path: `${fromFile}:${callLine} → ${toFile}:${toLine}`,
  fromId: fromFile,
  toId: toFile,
  symbolEdge
}
```

- Only fall back to file-level `edges` if `symbolEdges` is missing or empty.

### Execution path panel

Update `updateExecutionPathPanel(nodeId)`:

- If `symbolEdges` exists, show symbol-level rows grouped as:
  - `CALLS` / outbound edges where `fromFile === nodeId`
  - `CALLED BY` / inbound edges where `toFile === nodeId`
- Row label should include symbol names and line numbers.
- Clicking a row should:
  - highlight the file-level lane between `fromFile` and `toFile`
  - fly to the target file node
  - keep the execution-path panel visible

### Highlighting

Use file-level meshes/edges for now, because rendered nodes are still files.

- Highlight source file node.
- Highlight target file node.
- Highlight the file-level edge if it exists.
- If same-file call, highlight only that file node and panel row.

Do not create fake 3D function nodes for this task unless already supported by existing function orbit UI.

### Search behavior

`Cmd+K` / `Ctrl+K` must return symbol-level path results.

Queries like these should work:

- `handleLogin`
- `exchangeToken`
- `path auth`
- `calls token`
- `execution login`

## Verification checklist

Run these before committing:

```bash
node --check graph-generator.js
node --check generate-graph.js
node --check explorer.js
```

Then generate or load a graph and verify:

- `graphData.symbolEdges` exists.
- It contains real `fromSymbol` and `toSymbol` values.
- `Cmd+K` shows `[PATH] functionA → functionB` results.
- Clicking a path result highlights source and target files.
- Clicking a file node shows symbol-level `CALLS` and `CALLED BY` rows when data exists.
- Older graph payloads without `symbolEdges` still fall back to file dependency paths.

## Commit requirement

Commit and push the finished implementation.

Suggested commit message:

```bash
git commit -m "Add symbol-level static execution paths"
```

## Current known context

Recent commit before this work:

```text
c1fd55e Add static execution path explorer
```

That commit added the UI shell and approximate file-level path behavior. This task must replace the approximation with real symbol-level graph data while keeping backward compatibility.
