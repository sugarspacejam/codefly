window.closeTourQr = function() {
    const modal = document.getElementById('tourQrModal');
    if (!modal) {
        throw new Error('Tour QR modal missing');
    }
    modal.style.display = 'none';
}
