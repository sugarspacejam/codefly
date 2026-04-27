const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================
// EXCLUDED DIRECTORIES (exact segment match, not substring)
// ============================================================
const EXCLUDED_DIRS = new Set([
  'node_modules', '__pycache__', '.git', 'build', 'dist',
  'vendor', '.venv', 'venv', 'env', '.tox', '.mypy_cache',
  'target', 'bin', 'obj', '.gradle', '.idea', '.vscode',
  'coverage', '.next', '.nuxt', '.cache',
]);
const EXCLUDED_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']);

// ============================================================
// MULTI-LANGUAGE SUPPORT
// ============================================================
const LANG_CONFIG = {
  '.js':   { lang: 'javascript' },
  '.mjs':  { lang: 'javascript' },
  '.jsx':  { lang: 'javascript' },
  '.ts':   { lang: 'typescript' },
  '.tsx':  { lang: 'typescript' },
  '.py':   { lang: 'python' },
  '.go':   { lang: 'go' },
  '.java': { lang: 'java' },
  '.rs':   { lang: 'rust' },
  '.cs':   { lang: 'csharp' },
  '.rb':   { lang: 'ruby' },
  '.php':  { lang: 'php' },
  '.swift':{ lang: 'swift' },
  '.kt':   { lang: 'kotlin' },
  '.scala':{ lang: 'scala' },
  '.c':    { lang: 'c' },
  '.cpp':  { lang: 'cpp' },
  '.h':    { lang: 'c' },
  '.hpp':  { lang: 'cpp' },
  '.html': { lang: 'html' },
  '.htm':  { lang: 'html' },
  '.css':  { lang: 'css' },
  '.scss': { lang: 'css' },
  '.less': { lang: 'css' },
  '.vue':  { lang: 'vue' },
  '.svelte': { lang: 'svelte' },
  '.json': { lang: 'json' },
  '.yaml': { lang: 'yaml' },
  '.yml':  { lang: 'yaml' },
  '.md':   { lang: 'markdown' },
  '.sh':   { lang: 'shell' },
  '.bash': { lang: 'shell' },
  '.sql':  { lang: 'sql' },
  '.xml':  { lang: 'xml' },
  '.toml': { lang: 'toml' },
  '.env':  { lang: 'env' },
  '.dockerfile': { lang: 'docker' },
};

const SUPPORTED_EXTENSIONS = new Set(Object.keys(LANG_CONFIG));

const FILENAME_LANG = {
  'Dockerfile': 'docker',
  'Makefile': 'shell',
  'Jenkinsfile': 'shell',
  '.gitignore': 'env',
  '.dockerignore': 'env',
  '.editorconfig': 'env',
  '.eslintrc': 'json',
  '.prettierrc': 'json',
};

function shouldExcludeDir(dirName) {
  return EXCLUDED_DIRS.has(dirName);
}

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv', '.flac',
  '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.exe', '.dll', '.so', '.dylib', '.o', '.a',
  '.lock', '.map',
]);

function walkDir(dir, skippedExts) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.isDirectory()) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldExcludeDir(entry.name)) continue;
      results.push(...walkDir(fullPath, skippedExts));
    } else if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name)) || FILENAME_LANG[entry.name]) {
      if (EXCLUDED_FILES.has(entry.name)) continue;
      results.push(fullPath);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext && !BINARY_EXTENSIONS.has(ext) && !entry.name.startsWith('.')) {
        skippedExts.add(ext);
      }
    }
  }
  return results;
}

// ============================================================
// IMPORT EXTRACTION (per language)
// ============================================================
function extractImportsFromContent(content, lang) {
  const imports = new Set();

  const patterns = {
    javascript: [
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g,
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ],
    typescript: [
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g,
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ],
    python: [
      /^\s*import\s+(\S+)/gm,
      /^\s*from\s+(\S+)\s+import/gm,
    ],
    go: [
      /^\s*"([^"]+)"/gm,
    ],
    java: [
      /^\s*import\s+(?:static\s+)?([a-zA-Z0-9_.]+)/gm,
    ],
    rust: [
      /^\s*use\s+([a-zA-Z0-9_:]+)/gm,
      /^\s*(?:extern\s+crate|mod)\s+([a-zA-Z0-9_]+)/gm,
    ],
    csharp: [
      /^\s*using\s+(?:static\s+)?([a-zA-Z0-9_.]+)/gm,
    ],
    ruby: [
      /^\s*require\s+['"]([^'"]+)['"]/gm,
      /^\s*require_relative\s+['"]([^'"]+)['"]/gm,
    ],
    php: [
      /^\s*(?:use|include|include_once|require|require_once)\s+['"]?([^'";]+)/gm,
    ],
    swift: [
      /^\s*import\s+(\S+)/gm,
    ],
    kotlin: [
      /^\s*import\s+([a-zA-Z0-9_.]+)/gm,
    ],
    scala: [
      /^\s*import\s+([a-zA-Z0-9_.{}]+)/gm,
    ],
    c: [
      /^\s*#include\s+["<]([^">]+)[">]/gm,
    ],
    cpp: [
      /^\s*#include\s+["<]([^">]+)[">]/gm,
    ],
    html: [
      /<script\s+[^>]*src=["']([^"']+)["']/gi,
      /<link\s+[^>]*href=["']([^"']+)["']/gi,
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ],
    css: [
      /@import\s+(?:url\s*\(\s*)?['"]?([^'");\s]+)['"]?\s*\)?\s*;/gm,
    ],
    vue: [
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /<script\s+[^>]*src=["']([^"']+)["']/gi,
    ],
    svelte: [
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
    ],
    shell: [
      /^\s*(?:source|\.)\s+['"]?([^'";\s]+)['"]?/gm,
    ],
    sql: [],
    json: [],
    yaml: [],
    markdown: [],
    xml: [],
    toml: [],
    env: [],
    docker: [],
  };

  const langPatterns = patterns[lang];
  if (!langPatterns) return imports;

  for (const pattern of langPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      imports.add(match[1]);
    }
  }
  return imports;
}

// ============================================================
// DEFINITION EXTRACTION (per language) — functions, classes, variables
// ============================================================
const SKIP_KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'switch', 'catch', 'return',
  'new', 'throw', 'typeof', 'delete', 'void', 'try', 'finally',
  'do', 'break', 'continue', 'case', 'default', 'with',
]);

function extractDefinitionsFromContent(content, lang) {
  const defs = [];
  const seen = new Set();

  // Each entry: [regex, kind]
  const patterns = {
    javascript: [
      // functions
      [/^\s*(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm, 'function'],
      [/^\s*(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/gm, 'function'],
      [/^\s*(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/gm, 'function'],
      [/(?:module\.)?exports\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/gm, 'function'],
      // classes
      [/^\s*class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm, 'class'],
      // variables (top-level only — no indentation)
      [/^(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?!(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>)/gm, 'variable'],
    ],
    typescript: [
      // functions
      [/^\s*(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm, 'function'],
      [/^\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/gm, 'function'],
      [/^\s*(?:public|private|protected|static|async)*\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[<(]/gm, 'function'],
      // classes
      [/^\s*(?:export\s+)?(?:abstract\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm, 'class'],
      [/^\s*(?:export\s+)?interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm, 'class'],
      [/^\s*(?:export\s+)?enum\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm, 'class'],
      // variables (top-level or exported only)
      [/^(?:export\s+)?type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm, 'variable'],
      [/^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?::[^=]+)?\s*=\s*(?!(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>)/gm, 'variable'],
    ],
    python: [
      // functions
      [/^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 'function'],
      [/^\s*async\s+def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 'function'],
      // classes
      [/^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      // variables (module-level assignments, UPPER_CASE constants)
      [/^([A-Z][A-Z0-9_]*)\s*=/gm, 'variable'],
    ],
    go: [
      // functions
      [/^\s*func\s+(?:\([^)]*\)\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 'function'],
      // classes (structs/interfaces)
      [/^\s*type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:struct|interface)/gm, 'class'],
      // variables
      [/^\s*(?:var|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s/gm, 'variable'],
    ],
    java: [
      // functions
      [/^\s*(?:public|private|protected|static|final|abstract|synchronized|native)*\s*(?:[a-zA-Z_<>\[\]]+\s+)+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 'function'],
      // classes
      [/^\s*(?:public|private|protected)?\s*(?:abstract\s+)?class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:public\s+)?interface\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:public\s+)?enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      // variables (static final = constants)
      [/^\s*(?:public|private|protected)?\s*static\s+final\s+\S+\s+([A-Z][A-Z0-9_]*)\s*=/gm, 'variable'],
    ],
    rust: [
      // functions
      [/^\s*(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'function'],
      // classes
      [/^\s*(?:pub\s+)?struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:pub\s+)?enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:pub\s+)?trait\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*impl(?:<[^>]*>)?\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      // variables
      [/^\s*(?:pub\s+)?(?:static|const)\s+(?:mut\s+)?([A-Z][A-Z0-9_]*)\s*:/gm, 'variable'],
      [/^\s*let\s+(?:mut\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*/gm, 'variable'],
    ],
    csharp: [
      // functions
      [/^\s*(?:public|private|protected|internal|static|virtual|override|abstract|async)*\s*(?:[a-zA-Z_<>\[\]]+\s+)+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 'function'],
      // classes
      [/^\s*(?:public|private|protected|internal)?\s*(?:abstract|static|sealed|partial)*\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:public\s+)?interface\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:public\s+)?enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      // variables
      [/^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:readonly\s+)?\S+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[=;]/gm, 'variable'],
    ],
    ruby: [
      // functions
      [/^\s*def\s+(?:self\.)?([a-zA-Z_][a-zA-Z0-9_!?]*)/gm, 'function'],
      // classes
      [/^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*module\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      // variables (constants)
      [/^\s*([A-Z][A-Z0-9_]*)\s*=/gm, 'variable'],
    ],
    php: [
      // functions
      [/^\s*(?:public|private|protected|static)*\s*function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 'function'],
      // classes
      [/^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*interface\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*trait\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      // variables (class constants, define)
      [/^\s*const\s+([A-Z][A-Z0-9_]*)\s*=/gm, 'variable'],
      [/^\s*define\s*\(\s*['"]([A-Z][A-Z0-9_]*)['"]/gm, 'variable'],
    ],
    swift: [
      // functions
      [/^\s*(?:public|private|internal|open|fileprivate)?\s*(?:static|class)?\s*func\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'function'],
      // classes
      [/^\s*(?:public|private|internal|open)?\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:public|private|internal|open)?\s*struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:public|private|internal|open)?\s*protocol\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:public|private|internal|open)?\s*enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      // variables
      [/^\s*(?:public|private|internal|open)?\s*(?:static\s+)?(?:let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[=:]/gm, 'variable'],
    ],
    kotlin: [
      // functions
      [/^\s*(?:public|private|protected|internal|open|override|abstract)?\s*(?:suspend\s+)?fun\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'function'],
      // classes
      [/^\s*(?:public|private|protected|internal|open|abstract|data|sealed)?\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:public\s+)?interface\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:public\s+)?enum\s+class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:public\s+)?object\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      // variables
      [/^\s*(?:public|private|protected|internal)?\s*(?:val|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[=:]/gm, 'variable'],
    ],
    scala: [
      // functions
      [/^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'function'],
      // classes
      [/^\s*(?:case\s+)?class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*trait\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*object\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      // variables
      [/^\s*(?:val|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[=:]/gm, 'variable'],
    ],
    c: [
      // functions
      [/^\s*(?:static\s+)?(?:inline\s+)?(?:const\s+)?(?:unsigned\s+)?(?:signed\s+)?(?:long\s+)?(?:short\s+)?(?:void|int|char|float|double|bool|size_t|[a-zA-Z_]\w*\s*\*?)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 'function'],
      // classes
      [/^\s*(?:typedef\s+)?struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:typedef\s+)?enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      // variables
      [/^\s*#define\s+([A-Z][A-Z0-9_]*)/gm, 'variable'],
    ],
    cpp: [
      // functions
      [/^\s*(?:static\s+)?(?:inline\s+)?(?:virtual\s+)?(?:const\s+)?(?:void|int|char|float|double|bool|auto|std::\w+|[a-zA-Z_]\w*(?:<[^>]*>)?)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 'function'],
      // classes
      [/^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*namespace\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      // variables
      [/^\s*#define\s+([A-Z][A-Z0-9_]*)/gm, 'variable'],
      [/^\s*(?:const|constexpr)\s+\S+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/gm, 'variable'],
    ],
    html: [
      // JS functions inside <script> tags
      [/^\s*(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm, 'function'],
      [/^\s*(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/gm, 'function'],
      [/^\s*(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*function/gm, 'function'],
      // HTML element IDs
      [/\bid=["']([a-zA-Z_][a-zA-Z0-9_-]*)["']/gi, 'variable'],
      // CSS classes in HTML
      [/\bclass=["']([a-zA-Z_][a-zA-Z0-9_ -]*)["']/gi, 'class'],
    ],
    css: [
      // CSS custom properties
      [/^\s*(--[a-zA-Z][a-zA-Z0-9-]*)\s*:/gm, 'variable'],
      // @keyframes
      [/@keyframes\s+([a-zA-Z_][a-zA-Z0-9_-]*)/gm, 'function'],
      // class selectors (top-level)
      [/^\.([a-zA-Z_][a-zA-Z0-9_-]*)\s*[{,]/gm, 'class'],
      // ID selectors
      [/^#([a-zA-Z_][a-zA-Z0-9_-]*)\s*[{,]/gm, 'variable'],
    ],
    vue: [
      // same as JS
      [/^\s*(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm, 'function'],
      [/^\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/gm, 'function'],
      [/^\s*(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/gm, 'function'],
      [/^\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/gm, 'variable'],
    ],
    svelte: [
      [/^\s*(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm, 'function'],
      [/^\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/gm, 'function'],
      [/^\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/gm, 'variable'],
    ],
    shell: [
      // functions
      [/^\s*(?:function\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*\)\s*\{/gm, 'function'],
      // exported variables
      [/^\s*export\s+([A-Z][A-Z0-9_]*)=/gm, 'variable'],
      // top-level variable assignments (UPPER_CASE)
      [/^([A-Z][A-Z0-9_]*)=/gm, 'variable'],
    ],
    sql: [
      [/^\s*CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|")?([a-zA-Z_][a-zA-Z0-9_]*)(?:`|")?/gim, 'class'],
      [/^\s*CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:`|")?([a-zA-Z_][a-zA-Z0-9_]*)(?:`|")?/gim, 'class'],
      [/^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\s+(?:`|")?([a-zA-Z_][a-zA-Z0-9_]*)(?:`|")?/gim, 'function'],
      [/^\s*CREATE\s+(?:OR\s+REPLACE\s+)?INDEX\s+(?:`|")?([a-zA-Z_][a-zA-Z0-9_]*)(?:`|")?/gim, 'variable'],
    ],
    markdown: [
      // headings as sections
      [/^#{1,3}\s+(.+)$/gm, 'class'],
    ],
    json: [],
    yaml: [
      // top-level keys
      [/^([a-zA-Z_][a-zA-Z0-9_-]*):/gm, 'variable'],
    ],
    xml: [],
    toml: [
      // section headers
      [/^\[([a-zA-Z_][a-zA-Z0-9_.]*)\]/gm, 'class'],
    ],
    env: [
      // env variable names
      [/^([A-Z][A-Z0-9_]*)=/gm, 'variable'],
    ],
    docker: [
      // Dockerfile instructions as definitions
      [/^(FROM|RUN|CMD|ENTRYPOINT|EXPOSE|ENV|COPY|ADD|WORKDIR|VOLUME|ARG)\s/gm, 'function'],
    ],
  };

  const langPatterns = patterns[lang];
  if (!langPatterns) return defs;

  for (const [pattern, kind] of langPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1];
      if (!seen.has(name) && !SKIP_KEYWORDS.has(name) && name.length > 1) {
        seen.add(name);
        const lineNum = content.substring(0, match.index).split('\n').length;
        defs.push({ name, line: lineNum, kind });
      }
    }
  }
  return defs;
}

// ============================================================
// IMPORT RESOLUTION
// ============================================================
function resolveImport(importPath, fromFile, fileSet, lang, rootDir) {
  if (lang === 'python') {
    const pyPath = importPath.replace(/\./g, '/');
    const fromDir = path.dirname(fromFile);
    const candidates = [
      path.resolve(rootDir, pyPath + '.py'),
      path.resolve(rootDir, pyPath, '__init__.py'),
      path.resolve(fromDir, pyPath + '.py'),
      path.resolve(fromDir, pyPath, '__init__.py'),
    ];
    for (const c of candidates) {
      if (fileSet.has(c)) return c;
    }
    return null;
  }

  if (lang === 'javascript' || lang === 'typescript') {
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) return null;
    const fromDir = path.dirname(fromFile);
    const resolved = path.resolve(fromDir, importPath);
    const exts = lang === 'typescript'
      ? ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js']
      : ['', '.js', '.mjs', '.jsx', '/index.js'];
    for (const ext of exts) {
      if (fileSet.has(resolved + ext)) return resolved + ext;
    }
    return null;
  }

  if (lang === 'go') {
    return null;
  }

  if (lang === 'ruby') {
    if (!importPath.startsWith('.')) return null;
    const fromDir = path.dirname(fromFile);
    const resolved = path.resolve(fromDir, importPath);
    const candidates = [resolved, resolved + '.rb'];
    for (const c of candidates) {
      if (fileSet.has(c)) return c;
    }
    return null;
  }

  if (lang === 'c' || lang === 'cpp') {
    if (importPath.startsWith('<')) return null;
    const fromDir = path.dirname(fromFile);
    const resolved = path.resolve(fromDir, importPath);
    if (fileSet.has(resolved)) return resolved;
    return null;
  }

  if (lang === 'html' || lang === 'css' || lang === 'vue' || lang === 'svelte') {
    if (importPath.startsWith('http://') || importPath.startsWith('https://') || importPath.startsWith('//')) return null;
    const fromDir = path.dirname(fromFile);
    const resolved = path.resolve(fromDir, importPath);
    if (fileSet.has(resolved)) return resolved;
    return null;
  }

  return null;
}

// ============================================================
// GENERATE GRAPH (reusable function)
// ============================================================
function generateGraph(directory) {
  const skippedExts = new Set();
  const allFiles = walkDir(directory, skippedExts);
  const fileSet = new Set(allFiles);

  const nodes = [];
  const edges = [];
  const langStats = {};

  for (const file of allFiles) {
    const ext = path.extname(file);
    const basename = path.basename(file);
    const config = LANG_CONFIG[ext];
    const lang = config ? config.lang : FILENAME_LANG[basename];
    if (!lang) continue;
    langStats[lang] = (langStats[lang] || 0) + 1;

    const relPath = path.relative(directory, file);
    const folder = path.dirname(relPath).split(path.sep)[0] || '_root';

    const content = fs.readFileSync(file, 'utf-8');
    const allLines = content.split('\n');
    const lines = allLines.length;
    const definitions = extractDefinitionsFromContent(content, lang);
    const imports = extractImportsFromContent(content, lang);

    const previewLines = allLines
      .filter(l => l.trim().length > 0)
      .slice(0, 8)
      .map(l => l.length > 120 ? l.substring(0, 120) + '...' : l);

    const stat = fs.statSync(file);

    nodes.push({
      id: relPath,
      label: path.basename(relPath),
      folder: folder,
      lines: lines,
      fullPath: relPath,
      definitions: definitions,
      lang: lang,
      preview: previewLines,
      size: stat.size,
    });

    for (const imp of imports) {
      const resolved = resolveImport(imp, file, fileSet, lang, directory);
      if (resolved) {
        const targetRel = path.relative(directory, resolved);
        edges.push({ from: relPath, to: targetRel });
      }
    }
  }

  return {
    nodes,
    edges,
    meta: {
      languages: langStats,
      unsupportedExtensions: Array.from(skippedExts).sort(),
      totalFiles: allFiles.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

function cloneRepo(gitUrl) {
  const tmpDir = path.join(__dirname, '.tmp-repo-' + Date.now());
  execSync(`git clone --depth 1 ${gitUrl} ${tmpDir}`, { stdio: 'pipe' });
  return tmpDir;
}

module.exports = { generateGraph, cloneRepo };

// ============================================================
// CLI MODE
// ============================================================
if (require.main === module) {
  const TARGET_DIR = process.argv[2];
  if (!TARGET_DIR) {
    throw new Error('Usage: node generate-graph.js <directory-or-git-url>');
  }

  let scanDir;
  let needsCleanup = false;

  if (TARGET_DIR.startsWith('http://') || TARGET_DIR.startsWith('https://') || TARGET_DIR.startsWith('git@')) {
    scanDir = cloneRepo(TARGET_DIR);
    needsCleanup = true;
  } else {
    scanDir = path.resolve(TARGET_DIR);
  }

  const graphData = generateGraph(scanDir);

  if (needsCleanup) {
    fs.rmSync(scanDir, { recursive: true });
    console.log('Cleaned up cloned repo');
  }

  const outputFile = path.join(__dirname, 'graph-data.js');
  fs.writeFileSync(outputFile, `var graphData = ${JSON.stringify(graphData, null, 2)};`);

  console.log(`Nodes: ${graphData.nodes.length}`);
  console.log(`Edges: ${graphData.edges.length}`);
  console.log(`Languages:`, graphData.meta.languages);
  console.log(`Written to ${outputFile}`);
}
