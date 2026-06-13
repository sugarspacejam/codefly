window.showTourQr = function() {
    const link = buildTourLink();
    const modal = document.getElementById('tourQrModal');
    const img = document.getElementById('tourQrImg');
    const anchor = document.getElementById('tourQrLink');
    if (!modal || !img || !anchor) {
        throw new Error('Tour QR modal elements missing');
    }
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(link)}`;
    img.src = qrUrl;
    anchor.href = link;
    anchor.textContent = link;
    modal.style.display = 'block';
    document.exitPointerLock();
}
