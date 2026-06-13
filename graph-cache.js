// Graph cache for incremental sync
// Uses IndexedDB for graphData (large) and localStorage for file hashes (small)

const DB_NAME = 'codefly-graph-cache';
const DB_VERSION = 1;
const STORE_NAME = 'graphs';
const HASH_PREFIX = 'codefly-hashes-';

function getRepoKey(repoUrl, branch = 'main') {
  return `${repoUrl}#${branch}`;
}

// IndexedDB operations
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function saveCachedGraph(repoKey, graphData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(graphData, repoKey);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function loadCachedGraph(repoKey) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(repoKey);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

async function deleteCachedGraph(repoKey) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(repoKey);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// localStorage hash operations
function saveCachedHashes(repoKey, hashMap) {
  const key = HASH_PREFIX + repoKey;
  localStorage.setItem(key, JSON.stringify(hashMap));
}

function loadCachedHashes(repoKey) {
  const key = HASH_PREFIX + repoKey;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function deleteCachedHashes(repoKey) {
  const key = HASH_PREFIX + repoKey;
  localStorage.removeItem(key);
}

// Combined operations
async function saveCache(repoKey, graphData, hashMap) {
  await saveCachedGraph(repoKey, graphData);
  saveCachedHashes(repoKey, hashMap);
}

async function loadCache(repoKey) {
  const [graphData, hashMap] = await Promise.all([
    loadCachedGraph(repoKey),
    Promise.resolve(loadCachedHashes(repoKey)),
  ]);
  return { graphData, hashMap };
}

async function deleteCache(repoKey) {
  await deleteCachedGraph(repoKey);
  deleteCachedHashes(repoKey);
}

// Hash computation
async function computeHash(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Export for use in explorer.js and generate-graph.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getRepoKey,
    saveCachedGraph,
    loadCachedGraph,
    deleteCachedGraph,
    saveCachedHashes,
    loadCachedHashes,
    deleteCachedHashes,
    saveCache,
    loadCache,
    deleteCache,
    computeHash,
  };
}
