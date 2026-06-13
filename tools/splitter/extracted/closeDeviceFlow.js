window.closeDeviceFlow = function() {
    const modal = document.getElementById('deviceFlowModal');
    if (!modal) {
        throw new Error('Device flow modal missing');
    }
    modal.style.display = 'none';
}
