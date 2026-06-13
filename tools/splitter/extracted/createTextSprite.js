function createTextSprite(text, color, fontSize) {
    fontSize = fontSize || 28;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.font = `bold ${fontSize}px Courier New`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const c = new THREE.Color(color);
    ctx.fillStyle = `rgb(${Math.floor(c.r*255)},${Math.floor(c.g*255)},${Math.floor(c.b*255)})`;
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    return new THREE.Sprite(mat);
}
