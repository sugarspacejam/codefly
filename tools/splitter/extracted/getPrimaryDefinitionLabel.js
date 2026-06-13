function getPrimaryDefinitionLabel(node) {
    if (!node || !node.definitions || node.definitions.length === 0) {
        return node ? node.label : '';
    }
    const fn = node.definitions.find((def) => def.kind === 'function') || node.definitions[0];
    return `${fn.name}()`;
}
