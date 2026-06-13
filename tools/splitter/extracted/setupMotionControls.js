function setupMotionControls() {
    const panel = document.getElementById('motionControls');
    const moveSlider = document.getElementById('moveSpeedSlider');
    const orbitSlider = document.getElementById('orbitSpeedSlider');
    const pauseCheckbox = document.getElementById('pauseOrbitCheckbox');

    if (!panel) {
        throw new Error('motionControls element missing from DOM');
    }
    if (!moveSlider) {
        throw new Error('moveSpeedSlider element missing from DOM');
    }
    if (!orbitSlider) {
        throw new Error('orbitSpeedSlider element missing from DOM');
    }
    if (!pauseCheckbox) {
        throw new Error('pauseOrbitCheckbox element missing from DOM');
    }

    panel.style.display = 'block';

    const moveVal = Number(moveSlider.value);
    if (!Number.isFinite(moveVal)) {
        throw new Error('moveSpeedSlider value is invalid');
    }
    baseSpeed = moveVal;

    const orbitVal = Number(orbitSlider.value);
    if (!Number.isFinite(orbitVal)) {
        throw new Error('orbitSpeedSlider value is invalid');
    }
    orbitSpeed = orbitVal;

    orbitPaused = !!pauseCheckbox.checked;

    moveSlider.addEventListener('input', () => {
        const v = Number(moveSlider.value);
        if (!Number.isFinite(v)) {
            throw new Error('moveSpeedSlider value is invalid');
        }
        baseSpeed = v;
    });

    orbitSlider.addEventListener('input', () => {
        const v = Number(orbitSlider.value);
        if (!Number.isFinite(v)) {
            throw new Error('orbitSpeedSlider value is invalid');
        }
        orbitSpeed = v;
    });

    pauseCheckbox.addEventListener('change', () => {
        orbitPaused = !!pauseCheckbox.checked;
    });
}
