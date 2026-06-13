function updateCameraView() {
    if (isThirdPerson) {
        camera.position.set(0, 3, cameraDistance);
    } else {
        camera.position.set(0, 2, 0);
    }
}
