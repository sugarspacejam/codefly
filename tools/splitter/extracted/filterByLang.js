window.filterByLang = function(lang) {
    const ids = graphData.nodes
        .filter(n => n.lang === lang)
        .map(n => n.id);
    highlightNodes(ids, `${lang} files`);
}
