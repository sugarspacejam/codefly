function resolveIntentTarget(intentQuery) {
    const tokens = intentQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const expandedTokens = new Set(tokens);
    for (const t of tokens) {
        if (intentLexicon[t]) {
            intentLexicon[t].forEach((alt) => expandedTokens.add(alt));
        }
    }
    let best = null;
    let bestScore = 0;
    for (const node of graphData.nodes) {
        let score = 0;
        const haystack = `${node.label} ${node.fullPath}`.toLowerCase();
        for (const token of expandedTokens) {
            if (haystack.includes(token)) {
                score += 2;
            }
        }
        if (node.definitions) {
            for (const def of node.definitions) {
                const name = def.name.toLowerCase();
                for (const token of expandedTokens) {
                    if (name.includes(token)) score += 1;
                }
            }
        }
        if (score > bestScore) {
            bestScore = score;
            best = node;
        }
    }
    return bestScore > 0 ? best : null;
}
