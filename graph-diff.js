// Graph diffing and patching for incremental sync
// Compares file hashes, identifies changed files, patches graphData

function diffHashes(oldMap, newMap) {
  const added = [];
  const changed = [];
  const removed = [];
  const unchanged = [];

  for (const [path, newHash] of Object.entries(newMap)) {
    const oldHash = oldMap[path];
    if (!oldHash) {
      added.push({ path, hash: newHash });
    } else if (oldHash !== newHash) {
      changed.push({ path, oldHash, newHash });
    } else {
      unchanged.push({ path, hash: newHash });
    }
  }

  for (const [path, oldHash] of Object.entries(oldMap)) {
    if (!newMap[path]) {
      removed.push({ path, hash: oldHash });
    }
  }

  return { added, changed, removed, unchanged };
}

function patchGraph(graphData, changedFiles, newNodes, newEdges, newSymbolEdges) {
  const changedPaths = new Set(changedFiles.map(f => f.path));

  // Remove old nodes/edges for changed files
  graphData.nodes = graphData.nodes.filter(n => !changedPaths.has(n.id));
  graphData.edges = graphData.edges.filter(e => 
    !changedPaths.has(e.from) && !changedPaths.has(e.to)
  );
  graphData.symbolEdges = graphData.symbolEdges.filter(e => 
    !changedPaths.has(e.fromFile) && !changedPaths.has(e.toFile)
  );

  // Add new nodes/edges for changed files
  graphData.nodes.push(...newNodes);
  graphData.edges.push(...newEdges);
  graphData.symbolEdges.push(...newSymbolEdges);

  return graphData;
}

function buildHashMapFromGraph(graphData) {
  const map = {};
  for (const node of graphData.nodes) {
    if (node.hash) {
      map[node.id] = node.hash;
    }
  }
  return map;
}

// Export for use in explorer.js and generate-graph.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    diffHashes,
    patchGraph,
    buildHashMapFromGraph,
  };
}
