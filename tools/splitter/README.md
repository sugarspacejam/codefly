# Splitter Toolkit

Deterministic function extraction and file splitting toolkit. Preserves functions AS-IS without rewriting. Fails loud on rule violations.

## Installation

### Option 1: Copy directory

Copy the entire `tools/splitter` directory to your repository:

```bash
cp -r tools/splitter /path/to/your/repo/tools/splitter
```

### Option 2: npm install (local)

If you have this repository locally:

```bash
cd /path/to/your/repo
npm install /path/to/code-explorer/tools/splitter
```

Then use CLI commands directly.

## Principles

- Extract functions byte-for-byte unchanged
- Verify extracts match originals
- Track dependencies before any split
- Fail fast on size/duplicate/syntax violations
- No heredocs, no fallback operators, no inline algorithms

## Tools

### Analysis

- `01-list-functions.js` - Inventory all functions with line counts
- `04-build-function-manifest.js` - Build manifest with hashes
- `06-list-function-calls.js` - List which functions call which
- `07-list-globals-used.js` - List external identifiers each function uses
- `08-build-dependency-graph.js` - Build call graph
- `17-report-split-readiness.js` - Summary: function count, oversized list

### Extraction

- `02-extract-function.js` - Extract single function to file
- `03-extract-functions.js` - Extract all functions to directory
- `05-verify-extracted-function.js` - Byte-for-byte verification

### Safety Checks

- `09-check-duplicate-functions.js` - Fail on duplicate names
- `10-check-function-size.js` - Fail on functions exceeding max lines
- `11-check-file-size.js` - Fail if file exceeds max lines
- `12-check-output-collisions.js` - Fail if output files already exist
- `16-check-js-syntax.js` - Fail on syntax errors
- `19-check-no-heredoc.js` - Fail on heredoc markers
- `20-run-split-safety-checks.js` - Run all checks in sequence

### Orchestration

- `13-compare-manifests.js` - Verify manifest unchanged after split
- `14-build-module-file.js` - Rebuild file from extracted functions
- `15-plan-function-removal.js` - Plan removal positions for a function
- `18-write-function-index.js` - Write ES module index file

### Import/Variable Handling

- `21-list-imports-and-vars.js` - List imports and shared variables used by a function
- `22-copy-imports-and-vars.js` - Copy imports and variables to target file
- `23-check-still-used.js` - Check if import/variable still used in source after function removal

## Usage

### Direct node execution (copied directory)

```bash
node tools/splitter/01-list-functions.js explorer.js
```

### CLI commands (npm installed)

```bash
splitter-list explorer.js
splitter-extract-all explorer.js extracted/
splitter-check-all explorer.js
```

### Common operations

**Inventory a file**

```bash
# Direct
node tools/splitter/01-list-functions.js explorer.js

# CLI
splitter-list explorer.js
```

**Run all safety checks**

```bash
# Direct
node tools/splitter/20-run-split-safety-checks.js explorer.js

# CLI
splitter-check-all explorer.js
```

**Extract all functions**

```bash
mkdir -p tools/splitter/extracted
node tools/splitter/03-extract-functions.js explorer.js tools/splitter/extracted

# Or CLI
splitter-extract-all explorer.js extracted/
```

**Build manifest**

```bash
node tools/splitter/04-build-function-manifest.js explorer.js tools/splitter/manifest.json

# Or CLI
splitter-manifest explorer.js manifest.json
```

**Verify single extract**

```bash
node tools/splitter/02-extract-function.js explorer.js loadRecentRepos tools/splitter/scratch/loadRecentRepos.js
node tools/splitter/05-verify-extracted-function.js explorer.js loadRecentRepos tools/splitter/scratch/loadRecentRepos.js

# Or CLI
splitter-extract explorer.js loadRecentRepos scratch/loadRecentRepos.js
splitter-verify explorer.js loadRecentRepos scratch/loadRecentRepos.js
```

**Build dependency graph**

```bash
node tools/splitter/08-build-dependency-graph.js explorer.js

# Or CLI
splitter-deps explorer.js
```

**Check function size limit**

```bash
node tools/splitter/10-check-function-size.js explorer.js 30

# Or CLI
splitter-check-size explorer.js 30
```

## Safe Split Workflow

1. Inventory functions
2. Run safety checks
3. Extract all functions
4. Build manifest
5. Verify each extract (loop tool 05)
6. Analyze dependencies
7. Plan removals (tool 15 per function)
8. Apply removals to source
9. Rebuild module from extracts (tool 14)
10. Verify syntax of rebuilt file
11. Compare manifests (tool 13)

## Arguments

- `source file` - Path to JavaScript file to analyze
- `function name` - Name of function to extract/verify
- `target file` - Output file path
- `output directory` - Directory for extracted functions
- `manifest file` - Path to manifest JSON
- `max lines` - Maximum allowed lines (default: 30 for functions, 300 for files)
