window.closePatModal = function() {
    const modal = document.getElementById('patModal');
    if (!modal) {
        throw new Error('PAT modal missing');
    }
    modal.style.display = 'none';
}
