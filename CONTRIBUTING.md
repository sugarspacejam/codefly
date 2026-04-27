# Contributing to CodeFly

Thanks for helping make CodeFly better! The most-requested contribution is **language support**. Here's how.

## Adding a New Language

CodeFly uses regex to detect imports and definitions. Adding a language takes ~10 minutes and edits two files: `graph-generator.js` (browser/client) and `generate-graph.js` (server/CLI).

### 1. Register the file extension

In **`graph-generator.js`** and **`generate-graph.js`**, find `LANG_CONFIG` and add your extension:

```js
const LANG_CONFIG = {
  // ...existing...
  '.ex': 'elixir',
  '.exs': 'elixir',
};
```

If your language uses a special filename (like `Dockerfile`), add it to `FILENAME_LANG`.

### 2. Add import patterns

Find `extractImports` in both files. Add a regex array for your language:

```js
const patterns = {
  // ...existing...
  elixir: [
    /^\s*import\s+([A-Z][\w.]*)/gm,
    /^\s*alias\s+([A-Z][\w.]*)/gm,
    /^\s*require\s+([A-Z][\w.]*)/gm,
  ],
};
```

Each regex must capture the imported module/path in group 1.

### 3. Add definition patterns

Find `extractDefinitions`. Add patterns as `[regex, kind]` tuples (`kind` is `'function'`, `'class'`, or `'variable'`):

```js
const patterns = {
  // ...existing...
  elixir: [
    [/^\s*def\s+(\w+)/gm, 'function'],
    [/^\s*defp\s+(\w+)/gm, 'function'],
    [/^\s*defmodule\s+([A-Z][\w.]*)/gm, 'class'],
  ],
};
```

### 4. Add a language color (optional but nice)

In **`explorer.js`**, find `// Language colors` (~line 506) and add a hex color for your language so it shows up distinctly in the legend.

### 5. Test it

```bash
npm start
# Open http://localhost:8090
# Load a repo containing your language
```

Verify:
- Files appear as nodes
- Click a node — definitions are listed
- Edges (imports) connect to other files

### 6. Open a PR

Title: `Add <language> support`
Include: a screenshot of the 3D view loading a repo in your language.

## Reporting Bugs

Open an issue with:
- Repo URL or language used
- What you expected
- What happened
- Browser + OS

## Tree-sitter Migration (Future)

Long-term, regex parsing will be replaced with [tree-sitter WASM](https://tree-sitter.github.io/tree-sitter/) for proper AST-based extraction. If you want to help with that migration, open an issue.
