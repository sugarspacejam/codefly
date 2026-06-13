function openSearch() {
    const overlay = document.getElementById('searchOverlay');
    const input = document.getElementById('searchInput');
    overlay.style.display = 'block';
    input.value = '';
    input.focus();
    document.exitPointerLock();
    document.getElementById('searchResults').innerHTML = '';
}
