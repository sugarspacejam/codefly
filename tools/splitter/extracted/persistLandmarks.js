function persistLandmarks() {
    localStorage.setItem('codechat_landmarks', JSON.stringify(landmarks));
}
