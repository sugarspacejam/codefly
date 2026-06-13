window.playLandmarkTour = function() {
    if (landmarks.length === 0) {
        throw new Error('No landmarks saved for tour');
    }
    if (landmarkTourTimer) {
        clearInterval(landmarkTourTimer);
        landmarkTourTimer = null;
        return;
    }
    let idx = 0;
    flyToNode(landmarks[idx].id);
    landmarkTourTimer = setInterval(() => {
        idx = (idx + 1) % landmarks.length;
        flyToNode(landmarks[idx].id);
    }, 2400);
}
