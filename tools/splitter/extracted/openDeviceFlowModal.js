function openDeviceFlowModal(userCode) {
    const modal = document.getElementById('deviceFlowModal');
    const codeEl = document.getElementById('deviceFlowCode');
    if (!modal || !codeEl) {
        throw new Error('Device flow modal elements missing');
    }
    codeEl.textContent = userCode;
    modal.style.display = 'block';
    document.exitPointerLock();
}
