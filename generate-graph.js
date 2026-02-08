const fs = require('fs');
const path = require('path');

const TARGET_DIR = process.argv[2];
if (!TARGET_DIR) {
  throw new Error('Usage: node generate-graph.js <directory>');
}

const EXCLUDED = ['node_modules', '__pycache__', '.git', 'build', 'dist', 'test', 'artifacts', 'sdk', 'package-lock.json'];
const JS_EXTENSIONS = ['.js', '.mjs'];

function shouldExclude(filePath) {
  return EXCLUDED.some(ex => filePath.includes(ex));
}

function walkDir(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (shouldExclude(fullPath)) continue;
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (JS_EXTENSIONS.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports = new Set();

  const patterns = [
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\s+.*?from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      imports.add(match[1]);
    }
  }

  return imports;
}

function resolveImport(importPath, fromFile, fileSet) {
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }

  const fromDir = path.dirname(fromFile);
  let resolved = path.resolve(fromDir, importPath);

  const candidates = [
    resolved,
    resolved + '.js',
    resolved + '.mjs',
    path.join(resolved, 'index.js'),
  ];

  for (const candidate of candidates) {
    if (fileSet.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

const absTarget = path.resolve(TARGET_DIR);
const allFiles = walkDir(absTarget);
const fileSet = new Set(allFiles);

const nodes = [];
const edges = [];

for (const file of allFiles) {
  const relPath = path.relative(absTarget, file);
  const folder = path.dirname(relPath).split(path.sep)[0] || '_root';
  const lines = countLines(file);

  nodes.push({
    id: relPath,
    label: path.basename(relPath),
    folder: folder,
    lines: lines,
    fullPath: relPath
  });

  const imports = extractImports(file);
  for (const imp of imports) {
    const resolved = resolveImport(imp, file, fileSet);
    if (resolved) {
      const targetRel = path.relative(absTarget, resolved);
      edges.push({ from: relPath, to: targetRel });
    }
  }
}

const graphData = { nodes, edges };

const outputFile = path.join(__dirname, 'graph-data.js');
fs.writeFileSync(outputFile, `var graphData = ${JSON.stringify(graphData, null, 2)};`);

console.log(`Nodes: ${nodes.length}`);
console.log(`Edges: ${edges.length}`);
console.log(`Written to ${outputFile}`);
