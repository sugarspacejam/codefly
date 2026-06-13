// Node.js file-based cache for generate-graph.js CLI
// Uses .cache/ directory for storing graph data and hashes

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.join(__dirname, '.cache');

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getRepoKey(repoUrl, branch = 'main') {
  const safe = repoUrl.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safe}#${branch}`;
}

function getCachePath(repoKey, type) {
  ensureCacheDir();
  return path.join(CACHE_DIR, `${repoKey}.${type}.json`);
}

function saveCachedGraph(repoKey, graphData) {
  const cachePath = getCachePath(repoKey, 'graph');
  fs.writeFileSync(cachePath, JSON.stringify(graphData, null, 2));
}

function loadCachedGraph(repoKey) {
  const cachePath = getCachePath(repoKey, 'graph');
  if (!fs.existsSync(cachePath)) return null;
  try {
    const raw = fs.readFileSync(cachePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCachedHashes(repoKey, hashMap) {
  const cachePath = getCachePath(repoKey, 'hashes');
  fs.writeFileSync(cachePath, JSON.stringify(hashMap, null, 2));
}

function loadCachedHashes(repoKey) {
  const cachePath = getCachePath(repoKey, 'hashes');
  if (!fs.existsSync(cachePath)) return null;
  try {
    const raw = fs.readFileSync(cachePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function deleteCache(repoKey) {
  const graphPath = getCachePath(repoKey, 'graph');
  const hashPath = getCachePath(repoKey, 'hashes');
  if (fs.existsSync(graphPath)) fs.unlinkSync(graphPath);
  if (fs.existsSync(hashPath)) fs.unlinkSync(hashPath);
}

function saveCache(repoKey, graphData, hashMap) {
  saveCachedGraph(repoKey, graphData);
  saveCachedHashes(repoKey, hashMap);
}

function loadCache(repoKey) {
  const graphData = loadCachedGraph(repoKey);
  const hashMap = loadCachedHashes(repoKey);
  if (!graphData || !hashMap) return null;
  return { graphData, hashMap };
}

function computeHash(content) {
  return crypto.createHash('sha256').update(content || '').digest('hex');
}

module.exports = {
  getRepoKey,
  saveCachedGraph,
  loadCachedGraph,
  saveCachedHashes,
  loadCachedHashes,
  deleteCache,
  saveCache,
  loadCache,
  computeHash,
};
