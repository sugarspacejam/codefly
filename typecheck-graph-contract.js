// @ts-check

/** @typedef {import('./types/graph-contract').GraphData} GraphData */

/**
 * @param {GraphData} graph
 */
function assertGraphContract(graph) {
  graph.nodes.forEach((node) => {
    node.id;
    node.fullPath;
    node.definitions.forEach((definition) => {
      definition.name;
      definition.line;
      definition.kind;
    });
  });

  graph.edges.forEach((edge) => {
    edge.from;
    edge.to;
  });

  graph.symbolEdges.forEach((edge) => {
    edge.fromFile;
    edge.toFile;
    edge.fromSymbol;
    edge.toSymbol;
    edge.callLine;
    edge.type;
  });

  graph.meta.parseSummary.full;
  graph.meta.parseSummary.partial;
  graph.meta.parseSummary.unsupported;
}

module.exports = { assertGraphContract };
