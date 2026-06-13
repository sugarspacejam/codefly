function hydrateLandmarks() {
    const saved = localStorage.getItem('codechat_landmarks');
    if (!saved) {
        return;
    }
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
        throw new Error('Invalid landmarks data');
    }
    landmarks.length = 0;
    for (const lm of parsed) {
        if (lm && lm.id && lm.label) {
            landmarks.push(lm);
        }
    }
}
