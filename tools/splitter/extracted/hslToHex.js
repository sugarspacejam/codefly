function hslToHex(hslStr) {
    if (typeof hslStr === 'number') return hslStr;
    const match = hslStr.match(/hsl\((\d+)/);
    if (!match) return 0xffffff;
    const h = parseInt(match[1]) / 360;
    const s = 1;
    const l = 0.6;
    const c = new THREE.Color().setHSL(h, s, l);
    return c.getHex();
}
