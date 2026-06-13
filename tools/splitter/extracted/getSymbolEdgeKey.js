function getSymbolEdgeKey(edge) {
    if (!edge) return '';
    return `${edge.fromFile}|${edge.fromSymbol}|${edge.toFile}|${edge.toSymbol}|${edge.callLine}`;
}
