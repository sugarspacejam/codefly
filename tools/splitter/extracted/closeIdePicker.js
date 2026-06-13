window.closeIdePicker = function() {
    const modal = document.getElementById('idePickerModal');
    if (!modal) {
        throw new Error('IDE picker modal missing');
    }
    modal.style.display = 'none';
}
