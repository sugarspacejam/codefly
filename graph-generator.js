// ============================================================
// CLIENT-SIDE GRAPH GENERATOR — uses GitHub API, no server needed
// ============================================================

const EXCLUDED_DIRS = new Set([
  'node_modules', '__pycache__', '.git', 'build', 'dist',
  'vendor', '.venv', 'venv', 'env', '.tox', '.mypy_cache',
  'target', 'bin', 'obj', '.gradle', '.idea', '.vscode',
  'coverage', '.next', '.nuxt', '.cache',
]);
const EXCLUDED_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']);

const LANG_CONFIG = {
  '.js':   'javascript', '.mjs':  'javascript', '.jsx':  'javascript',
  '.ts':   'typescript', '.tsx':  'typescript',
  '.py':   'python', '.go': 'go', '.java': 'java', '.rs': 'rust',
  '.cs':   'csharp', '.rb': 'ruby', '.php': 'php', '.swift': 'swift',
  '.kt':   'kotlin', '.scala': 'scala', '.c': 'c', '.cpp': 'cpp',
  '.h':    'c', '.hpp': 'cpp',
  '.html': 'html', '.htm': 'html', '.css': 'css', '.scss': 'css', '.less': 'css',
  '.vue':  'vue', '.svelte': 'svelte',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
  '.md':   'markdown', '.sh': 'shell', '.bash': 'shell',
  '.sql':  'sql', '.xml': 'xml', '.toml': 'toml', '.env': 'env',
  '.dockerfile': 'docker',
};

const FILENAME_LANG = {
  'Dockerfile': 'docker', 'Makefile': 'shell', 'Jenkinsfile': 'shell',
  '.gitignore': 'env', '.dockerignore': 'env', '.editorconfig': 'env',
  '.eslintrc': 'json', '.prettierrc': 'json',
};

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv', '.flac',
  '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.exe', '.dll', '.so', '.dylib', '.o', '.a',
  '.lock', '.map',
]);

// ============================================================
// LOCAL FOLDER LOADING (File System Access API)
// ============================================================
async function walkLocalFolder(rootHandle, onProgress) {
  if (!rootHandle) {
    throw new Error('walkLocalFolder requires a directory handle');
  }
  if (rootHandle.kind !== 'directory') {
    throw new Error('walkLocalFolder expected a directory handle');
  }

  const files = [];
  const stack = [{ handle: rootHandle, path: '' }];
  let visited = 0;

  while (stack.length > 0) {
    const { handle, path } = stack.pop();
    for await (const entry of handle.values()) {
      if (entry.kind === 'directory') {
        if (EXCLUDED_DIRS.has(entry.name) || entry.name.startsWith('.')) {
          continue;
        }
        const nextPath = path ? `${path}/${entry.name}` : entry.name;
        stack.push({ handle: entry, path: nextPath });
      } else if (entry.kind === 'file') {
        if (EXCLUDED_FILES.has(entry.name)) {
          continue;
        }
        const nextPath = path ? `${path}/${entry.name}` : entry.name;
        const ext = entry.name.includes('.') ? '.' + entry.name.split('.').pop().toLowerCase() : '';
        const lang = LANG_CONFIG[ext] || FILENAME_LANG[entry.name];
        if (lang) {
          const file = await entry.getFile();
          files.push({ handle: entry, path: nextPath, size: file.size, lang });
        } else if (ext && !BINARY_EXTENSIONS.has(ext) && !entry.name.startsWith('.')) {
          // Keep unsupported extensions for limitations banner
          files.push({ handle: entry, path: nextPath, size: 0, lang: null, unsupportedExt: ext });
        }
        visited++;
        if (onProgress && visited % 50 === 0) {
          onProgress(`Scanning local folder... ${visited} items`);
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    }
  }

  return files;
}

// ============================================================
// GITHUB API
// ============================================================
function parseGitHubUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

// ============================================================
// GITLAB API
// ============================================================
function parseGitLabUrl(url) {
  const idx = url.indexOf('gitlab.com/');
  if (idx === -1) return null;
  const after = url.substring(idx + 'gitlab.com/'.length);
  const cleaned = after.replace(/^\/+/, '').replace(/\.git$/, '').replace(/\/+$/, '');
  if (!cleaned) return null;
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const namespacePath = parts.join('/');
  const projectId = encodeURIComponent(namespacePath);
  return { namespacePath, projectId };
}

async function fetchGitLabProject(projectId, token) {
  if (!token) {
    throw new Error('GitLab token is required to fetch project metadata');
  }
  const headers = { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` };
  const res = await fetch(`https://gitlab.com/api/v4/projects/${projectId}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitLab project fetch failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  if (!data || !data.default_branch || !data.path_with_namespace) {
    throw new Error('GitLab project response missing default_branch or path_with_namespace');
  }
  return { defaultBranch: data.default_branch, pathWithNamespace: data.path_with_namespace, headers };
}

async function fetchGitLabTree(projectId, branch, headers) {
  const all = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const url = new URL(`https://gitlab.com/api/v4/projects/${projectId}/repository/tree`);
    url.searchParams.set('ref', branch);
    url.searchParams.set('recursive', 'true');
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('page', String(page));

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitLab tree fetch failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('GitLab tree response is not an array');
    }
    all.push(...data);

    const nextPage = res.headers.get('x-next-page');
    if (!nextPage) {
      break;
    }
    page = Number(nextPage);
    if (!Number.isFinite(page) || page <= 0) {
      throw new Error('GitLab pagination header x-next-page is invalid');
    }
  }
  return all;
}

async function fetchGitLabFileRaw(projectId, branch, filePath, headers) {
  const encodedPath = encodeURIComponent(filePath);
  const url = `https://gitlab.com/api/v4/projects/${projectId}/repository/files/${encodedPath}/raw?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return await res.text();
}

async function fetchGitHubTree(owner, repo, token) {
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `token ${token}`;

  // Get default branch
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!repoRes.ok) {
    const err = await repoRes.json();
    throw new Error(err.message || `GitHub API error: ${repoRes.status}`);
  }
  const repoData = await repoRes.json();
  const branch = repoData.default_branch;

  // Get full tree
  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers });
  if (!treeRes.ok) {
    const err = await treeRes.json();
    throw new Error(err.message || `GitHub tree error: ${treeRes.status}`);
  }
  const treeData = await treeRes.json();
  if (treeData.truncated) {
    console.warn('Tree was truncated — very large repo');
  }
  return { tree: treeData.tree, branch, headers };
}

async function fetchFileContent(owner, repo, filePath, headers) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.encoding !== 'base64') {
    return null;
  }
  if (!data.content) {
    throw new Error('GitHub contents API returned base64 encoding but no content');
  }

  const b64 = data.content.replace(/\n/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

async function fetchLastCommitDate(owner, repo, filePath, headers) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(filePath)}&per_page=1`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0 || !data[0].commit || !data[0].commit.committer) {
    return null;
  }
  return data[0].commit.committer.date || null;
}

async function fetchCommitDatesForRepo(repoFull, token, files, onProgress) {
  const parts = repoFull.split('/');
  if (parts.length !== 2) {
    throw new Error('Invalid repo format for commit fetch. Expected owner/repo.');
  }
  const owner = parts[0];
  const repo = parts[1];
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `token ${token}`;

  const commitDates = {};
  let processed = 0;
  for (const file of files) {
    const date = await fetchLastCommitDate(owner, repo, file.path, headers);
    if (date) {
      commitDates[file.path] = date;
    }
    processed++;
    if (onProgress) onProgress(`Commit dates ${processed}/${files.length}`);
  }

  return commitDates;
}

async function fetchBlameForRepo(repoFull, token, files, onProgress) {
  const parts = repoFull.split('/');
  if (parts.length !== 2) {
    throw new Error('Invalid repo format for blame fetch. Expected owner/repo.');
  }
  const owner = parts[0];
  const repo = parts[1];
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `token ${token}`;

  const blameData = {};
  let processed = 0;
  for (const file of files) {
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(file.path)}&per_page=1`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].commit) {
        const authorObj = data[0].commit.author || data[0].commit.committer;
        if (!authorObj || !authorObj.name || !authorObj.date) {
          throw new Error(`Invalid author data returned for ${file.path}`);
        }
        blameData[file.path] = {
          author: authorObj.name,
          email: authorObj.email || '',
          date: authorObj.date,
        };
      }
    }
    processed++;
    if (onProgress) onProgress(`Blame ${processed}/${files.length}`);
  }
  return blameData;
}

// ============================================================
// FILE FILTERING
// ============================================================
function filterTree(tree) {
  const files = [];
  const skippedExts = new Set();

  for (const item of tree) {
    if (item.type !== 'blob') continue;
    const parts = item.path.split('/');
    const fileName = parts[parts.length - 1];

    // Check excluded dirs
    let excluded = false;
    for (let i = 0; i < parts.length - 1; i++) {
      if (EXCLUDED_DIRS.has(parts[i]) || parts[i].startsWith('.')) {
        excluded = true;
        break;
      }
    }
    if (excluded) continue;
    if (EXCLUDED_FILES.has(fileName)) continue;

    const ext = fileName.includes('.') ? '.' + fileName.split('.').pop().toLowerCase() : '';
    const lang = LANG_CONFIG[ext] || FILENAME_LANG[fileName];

    if (lang) {
      files.push({ path: item.path, size: item.size || 0, lang });
    } else if (ext && !BINARY_EXTENSIONS.has(ext) && !fileName.startsWith('.')) {
      skippedExts.add(ext);
    }
  }

  return { files, skippedExts };
}

// ============================================================
// IMPORT EXTRACTION
// ============================================================
function extractImports(content, lang) {
  const imports = new Set();
  const patterns = {
    javascript: [
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g,
    ],
    typescript: [
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ],
    python: [/^\s*import\s+(\S+)/gm, /^\s*from\s+(\S+)\s+import/gm],
    go: [/^\s*"([^"]+)"/gm],
    java: [/^\s*import\s+(?:static\s+)?([a-zA-Z0-9_.]+)/gm],
    rust: [/^\s*use\s+([a-zA-Z0-9_:]+)/gm],
    csharp: [/^\s*using\s+(?:static\s+)?([a-zA-Z0-9_.]+)/gm],
    ruby: [/^\s*require\s+['"]([^'"]+)['"]/gm, /^\s*require_relative\s+['"]([^'"]+)['"]/gm],
    php: [/^\s*(?:use|include|require)\s+['"]?([^'";]+)/gm],
    swift: [/^\s*import\s+(\S+)/gm],
    kotlin: [/^\s*import\s+([a-zA-Z0-9_.]+)/gm],
    scala: [/^\s*import\s+([a-zA-Z0-9_.{}]+)/gm],
    c: [/^\s*#include\s+["<]([^">]+)[">]/gm],
    cpp: [/^\s*#include\s+["<]([^">]+)[">]/gm],
    html: [/<script\s+[^>]*src=["']([^"']+)["']/gi, /<link\s+[^>]*href=["']([^"']+)["']/gi],
    css: [/@import\s+(?:url\s*\(\s*)?['"]?([^'");\s]+)['"]?\s*\)?\s*;/gm],
    vue: [/import\s+.*?from\s+['"]([^'"]+)['"]/g],
    svelte: [/import\s+.*?from\s+['"]([^'"]+)['"]/g],
    shell: [/^\s*(?:source|\.)\s+['"]?([^'";\s]+)['"]?/gm],
    sql: [], json: [], yaml: [], markdown: [], xml: [], toml: [], env: [], docker: [],
  };
  const langPatterns = patterns[lang];
  if (!langPatterns) return imports;
  for (const pattern of langPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) imports.add(match[1]);
  }
  return imports;
}

// ============================================================
// DEFINITION EXTRACTION
// ============================================================
const SKIP_KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'switch', 'catch', 'return',
  'new', 'throw', 'typeof', 'delete', 'void', 'try', 'finally',
  'do', 'break', 'continue', 'case', 'default', 'with',
]);

function extractDefinitions(content, lang) {
  const defs = [];
  const seen = new Set();
  const patterns = {
    javascript: [
      [/^\s*(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm, 'function'],
      [/^\s*(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/gm, 'function'],
      [/^\s*(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/gm, 'function'],
      [/(?:module\.)?exports\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/gm, 'function'],
      [/^\s*class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm, 'class'],
      [/^(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?!(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>)/gm, 'variable'],
    ],
    typescript: [
      [/^\s*(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm, 'function'],
      [/^\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/gm, 'function'],
      [/^\s*(?:export\s+)?(?:abstract\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm, 'class'],
      [/^\s*(?:export\s+)?interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm, 'class'],
      [/^\s*(?:export\s+)?enum\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm, 'class'],
      [/^(?:export\s+)?type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm, 'variable'],
    ],
    python: [
      [/^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 'function'],
      [/^\s*async\s+def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 'function'],
      [/^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^([A-Z][A-Z0-9_]*)\s*=/gm, 'variable'],
    ],
    go: [
      [/^\s*func\s+(?:\([^)]*\)\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 'function'],
      [/^\s*type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:struct|interface)/gm, 'class'],
    ],
    java: [
      [/^\s*(?:public|private|protected|static|final|abstract|synchronized|native)*\s*(?:[a-zA-Z_<>\[\]]+\s+)+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 'function'],
      [/^\s*(?:public|private|protected)?\s*(?:abstract\s+)?class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:public\s+)?interface\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
    ],
    rust: [
      [/^\s*(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'function'],
      [/^\s*(?:pub\s+)?struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:pub\s+)?enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:pub\s+)?trait\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
    ],
    csharp: [
      [/^\s*(?:public|private|protected|internal|static|virtual|override|abstract|async)*\s*(?:[a-zA-Z_<>\[\]]+\s+)+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 'function'],
      [/^\s*(?:public|private|protected|internal)?\s*(?:abstract|static|sealed|partial)*\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
    ],
    ruby: [
      [/^\s*def\s+(?:self\.)?([a-zA-Z_][a-zA-Z0-9_!?]*)/gm, 'function'],
      [/^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*module\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
    ],
    php: [
      [/^\s*(?:public|private|protected|static)*\s*function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 'function'],
      [/^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
    ],
    swift: [
      [/^\s*(?:public|private|internal|open|fileprivate)?\s*(?:static|class)?\s*func\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'function'],
      [/^\s*(?:public|private|internal|open)?\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:public|private|internal|open)?\s*struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:public|private|internal|open)?\s*protocol\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*(?:public|private|internal|open)?\s*enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
    ],
    kotlin: [
      [/^\s*(?:public|private|protected|internal|open|override|abstract)?\s*(?:suspend\s+)?fun\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'function'],
      [/^\s*(?:public|private|protected|internal|open|abstract|data|sealed)?\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
    ],
    scala: [
      [/^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'function'],
      [/^\s*(?:case\s+)?class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*trait\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*object\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
    ],
    c: [
      [/^\s*(?:static\s+)?(?:inline\s+)?(?:void|int|char|float|double|bool|size_t|[a-zA-Z_]\w*\s*\*?)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 'function'],
      [/^\s*(?:typedef\s+)?struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*#define\s+([A-Z][A-Z0-9_]*)/gm, 'variable'],
    ],
    cpp: [
      [/^\s*(?:static\s+)?(?:inline\s+)?(?:virtual\s+)?(?:void|int|char|float|double|bool|auto|[a-zA-Z_]\w*)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm, 'function'],
      [/^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
      [/^\s*namespace\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm, 'class'],
    ],
    html: [
      [/^\s*(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm, 'function'],
      [/\bid=["']([a-zA-Z_][a-zA-Z0-9_-]*)["']/gi, 'variable'],
    ],
    css: [
      [/^\s*(--[a-zA-Z][a-zA-Z0-9-]*)\s*:/gm, 'variable'],
      [/@keyframes\s+([a-zA-Z_][a-zA-Z0-9_-]*)/gm, 'function'],
      [/^\.([a-zA-Z_][a-zA-Z0-9_-]*)\s*[{,]/gm, 'class'],
    ],
    vue: [
      [/^\s*(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm, 'function'],
      [/^\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/gm, 'variable'],
    ],
    svelte: [
      [/^\s*(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm, 'function'],
      [/^\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/gm, 'variable'],
    ],
    shell: [
      [/^\s*(?:function\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*\)\s*\{/gm, 'function'],
      [/^([A-Z][A-Z0-9_]*)=/gm, 'variable'],
    ],
    sql: [
      [/^\s*CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|")?([a-zA-Z_][a-zA-Z0-9_]*)(?:`|")?/gim, 'class'],
      [/^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\s+(?:`|")?([a-zA-Z_][a-zA-Z0-9_]*)(?:`|")?/gim, 'function'],
    ],
    markdown: [[/^#{1,3}\s+(.+)$/gm, 'class']],
    json: [], yaml: [[/^([a-zA-Z_][a-zA-Z0-9_-]*):/gm, 'variable']],
    xml: [], toml: [[/^\[([a-zA-Z_][a-zA-Z0-9_.]*)\]/gm, 'class']],
    env: [[/^([A-Z][A-Z0-9_]*)=/gm, 'variable']],
    docker: [[/^(FROM|RUN|CMD|ENTRYPOINT|EXPOSE|ENV|COPY|ADD|WORKDIR|VOLUME|ARG)\s/gm, 'function']],
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
// IMPORT RESOLUTION (path-based, relative only)
// ============================================================
function resolveImport(importPath, fromFile, fileSet, lang) {
  if (lang === 'python') {
    const pyPath = importPath.replace(/\./g, '/');
    const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
    const candidates = [
      pyPath + '.py', pyPath + '/__init__.py',
      fromDir + '/' + pyPath + '.py', fromDir + '/' + pyPath + '/__init__.py',
    ];
    for (const c of candidates) {
      const normalized = normalizePath(c);
      if (fileSet.has(normalized)) return normalized;
    }
    return null;
  }

  if (lang === 'javascript' || lang === 'typescript') {
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) return null;
    const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
    const resolved = normalizePath(fromDir + '/' + importPath);
    const exts = lang === 'typescript'
      ? ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js']
      : ['', '.js', '.mjs', '.jsx', '/index.js'];
    for (const ext of exts) {
      if (fileSet.has(resolved + ext)) return resolved + ext;
    }
    return null;
  }

  if (lang === 'ruby') {
    if (!importPath.startsWith('.')) return null;
    const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
    const resolved = normalizePath(fromDir + '/' + importPath);
    if (fileSet.has(resolved)) return resolved;
    if (fileSet.has(resolved + '.rb')) return resolved + '.rb';
    return null;
  }

  if (lang === 'c' || lang === 'cpp') {
    if (importPath.startsWith('<')) return null;
    const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
    const resolved = normalizePath(fromDir + '/' + importPath);
    if (fileSet.has(resolved)) return resolved;
    return null;
  }

  if (lang === 'html' || lang === 'css' || lang === 'vue' || lang === 'svelte') {
    if (importPath.startsWith('http://') || importPath.startsWith('https://') || importPath.startsWith('//')) return null;
    const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
    const resolved = normalizePath(fromDir + '/' + importPath);
    if (fileSet.has(resolved)) return resolved;
    return null;
  }

  return null;
}

function normalizePath(p) {
  const parts = [];
  for (const seg of p.split('/')) {
    if (seg === '..') { parts.pop(); }
    else if (seg !== '.' && seg !== '') { parts.push(seg); }
  }
  return parts.join('/');
}

// ============================================================
// MAIN: generateGraphFromGitHub
// ============================================================
async function generateGraphFromGitHub(githubUrl, token, onProgress) {
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) throw new Error('Invalid GitHub URL. Use: https://github.com/owner/repo');

  if (onProgress) onProgress('Fetching repository tree...');
  const { tree, branch, headers } = await fetchGitHubTree(parsed.owner, parsed.repo, token);

  const { files, skippedExts } = filterTree(tree);
  if (files.length === 0) throw new Error('No supported source files found in this repo');

  if (onProgress) onProgress(`Found ${files.length} files. Fetching contents...`);

  const fileSet = new Set(files.map(f => f.path));
  const nodes = [];
  const edges = [];
  const langStats = {};

  // Batch fetch — up to 20 concurrent
  const BATCH_SIZE = 20;
  let fetched = 0;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (file) => {
        const content = await fetchFileContent(parsed.owner, parsed.repo, file.path, headers);
        return { file, content };
      })
    );

    for (const { file, content } of results) {
      fetched++;
      if (!content) continue;

      const lang = file.lang;
      langStats[lang] = (langStats[lang] || 0) + 1;

      const parts = file.path.split('/');
      const folder = parts.length > 1 ? parts[0] : '_root';
      const allLines = content.split('\n');

      const previewLines = allLines
        .filter(l => l.trim().length > 0)
        .slice(0, 8)
        .map(l => l.length > 120 ? l.substring(0, 120) + '...' : l);

      const definitions = extractDefinitions(content, lang);
      const imports = extractImports(content, lang);

      nodes.push({
        id: file.path,
        label: parts[parts.length - 1],
        folder: folder,
        lines: allLines.length,
        fullPath: file.path,
        definitions: definitions,
        lang: lang,
        preview: previewLines,
        size: file.size,
      });

      for (const imp of imports) {
        const resolved = resolveImport(imp, file.path, fileSet, lang);
        if (resolved) {
          edges.push({ from: file.path, to: resolved });
        }
      }
    }

    if (onProgress) onProgress(`Analyzed ${fetched}/${files.length} files...`);
  }

  return {
    nodes,
    edges,
    meta: {
      languages: langStats,
      unsupportedExtensions: Array.from(skippedExts).sort(),
      totalFiles: files.length,
      generatedAt: new Date().toISOString(),
      repo: `${parsed.owner}/${parsed.repo}`,
      branch,
      provider: 'github',
    },
  };
}

// ============================================================
// MAIN: generateGraphFromLocalFolder
// ============================================================
async function generateGraphFromLocalFolder(directoryHandle, onProgress) {
  if (!directoryHandle) {
    throw new Error('generateGraphFromLocalFolder requires a directory handle');
  }
  if (directoryHandle.kind !== 'directory') {
    throw new Error('generateGraphFromLocalFolder expected a directory handle');
  }

  if (onProgress) onProgress('Scanning local folder...');
  const rawEntries = await walkLocalFolder(directoryHandle, onProgress);
  if (!Array.isArray(rawEntries)) {
    throw new Error('Local folder scan failed to return file entries');
  }

  const files = rawEntries.filter((f) => f.lang);
  const unsupportedExts = new Set(
    rawEntries.filter((f) => f.unsupportedExt).map((f) => f.unsupportedExt)
  );

  if (files.length === 0) {
    throw new Error('No supported source files found in this folder');
  }

  if (onProgress) onProgress(`Found ${files.length} files. Reading contents...`);

  const fileSet = new Set(files.map((f) => f.path));
  const nodes = [];
  const edges = [];
  const langStats = {};

  const BATCH_SIZE = 20;
  let processed = 0;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (file) => {
        const blob = await file.handle.getFile();
        const content = await blob.text();
        return { file, content };
      })
    );

    for (const { file, content } of results) {
      processed++;
      if (!content) continue;

      const lang = file.lang;
      langStats[lang] = (langStats[lang] || 0) + 1;

      const parts = file.path.split('/');
      const folder = parts.length > 1 ? parts[0] : '_root';
      const allLines = content.split('\n');

      const previewLines = allLines
        .filter(l => l.trim().length > 0)
        .slice(0, 8)
        .map(l => l.length > 120 ? l.substring(0, 120) + '...' : l);

      const definitions = extractDefinitions(content, lang);
      const imports = extractImports(content, lang);

      nodes.push({
        id: file.path,
        label: parts[parts.length - 1],
        folder: folder,
        lines: allLines.length,
        fullPath: file.path,
        definitions: definitions,
        lang: lang,
        preview: previewLines,
        size: file.size,
      });

      for (const imp of imports) {
        const resolved = resolveImport(imp, file.path, fileSet, lang);
        if (resolved) edges.push({ from: file.path, to: resolved });
      }
    }

    if (onProgress) onProgress(`Analyzed ${processed}/${files.length} files...`);
    await new Promise((r) => setTimeout(r, 0));
  }

  return {
    nodes,
    edges,
    meta: {
      languages: langStats,
      unsupportedExtensions: Array.from(unsupportedExts).sort(),
      totalFiles: files.length,
      generatedAt: new Date().toISOString(),
      repo: directoryHandle.name,
      branch: 'local',
      provider: 'local',
    },
  };
}

// ============================================================
// MAIN: generateGraphFromGitLab
// ============================================================
async function generateGraphFromGitLab(gitlabUrl, token, onProgress) {
  const parsed = parseGitLabUrl(gitlabUrl);
  if (!parsed) throw new Error('Invalid GitLab URL. Use: https://gitlab.com/group/project');
  if (!token) throw new Error('GitLab token is required for GitLab graph generation');

  if (onProgress) onProgress('Fetching GitLab project...');
  const project = await fetchGitLabProject(parsed.projectId, token);
  const branch = project.defaultBranch;

  if (onProgress) onProgress('Fetching repository tree...');
  const tree = await fetchGitLabTree(parsed.projectId, branch, project.headers);

  const normalizedTree = tree.map((item) => {
    return { type: item.type, path: item.path, size: 0 };
  });

  const { files, skippedExts } = filterTree(normalizedTree);
  if (files.length === 0) throw new Error('No supported source files found in this repo');

  if (onProgress) onProgress(`Found ${files.length} files. Fetching contents...`);

  const fileSet = new Set(files.map((f) => f.path));
  const nodes = [];
  const edges = [];
  const langStats = {};

  const BATCH_SIZE = 20;
  let fetched = 0;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (file) => {
        const content = await fetchGitLabFileRaw(parsed.projectId, branch, file.path, project.headers);
        return { file, content };
      })
    );

    for (const { file, content } of results) {
      fetched++;
      if (!content) continue;

      const lang = file.lang;
      langStats[lang] = (langStats[lang] || 0) + 1;

      const parts = file.path.split('/');
      const folder = parts.length > 1 ? parts[0] : '_root';
      const allLines = content.split('\n');

      const previewLines = allLines
        .filter((l) => l.trim().length > 0)
        .slice(0, 8)
        .map((l) => (l.length > 120 ? l.substring(0, 120) + '...' : l));

      const definitions = extractDefinitions(content, lang);
      const imports = extractImports(content, lang);

      nodes.push({
        id: file.path,
        label: parts[parts.length - 1],
        folder: folder,
        lines: allLines.length,
        fullPath: file.path,
        definitions: definitions,
        lang: lang,
        preview: previewLines,
        size: file.size,
      });

      for (const imp of imports) {
        const resolved = resolveImport(imp, file.path, fileSet, lang);
        if (resolved) {
          edges.push({ from: file.path, to: resolved });
        }
      }
    }

    if (onProgress) onProgress(`Analyzed ${fetched}/${files.length} files...`);
  }

  return {
    nodes,
    edges,
    meta: {
      languages: langStats,
      unsupportedExtensions: Array.from(skippedExts).sort(),
      totalFiles: files.length,
      generatedAt: new Date().toISOString(),
      repo: project.pathWithNamespace,
      branch,
      provider: 'gitlab',
    },
  };
}
