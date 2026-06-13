function importTourFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const tour = params.get('tour');
    if (!tour) {
        return;
    }
    const ids = tour.split(',').filter(Boolean);
    for (const id of ids) {
        const node = graphData.nodes.find((n) => n.id === id);
        if (node) {
            addLandmark(node);
        }
    }
}
