function updateFlyTarget() {
    if (!flyTarget.active) {
        return;
    }
    flyTarget.progress += 1;
    const t = flyTarget.progress / flyTarget.durationFrames;
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    playerGroup.position.lerpVectors(flyTarget.from, flyTarget.to, Math.min(eased, 1));
    if (flyTarget.progress >= flyTarget.durationFrames) {
        flyTarget.active = false;
    }
}
