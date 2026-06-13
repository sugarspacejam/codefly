function buildTourLink() {
    if (landmarks.length === 0) {
        throw new Error('No landmarks to export as tour link');
    }
    const ids = landmarks.map((lm) => lm.id).join(',');
    const url = new URL(window.location.href);
    url.searchParams.set('tour', ids);
    return url.toString();
}
