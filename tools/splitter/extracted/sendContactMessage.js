window.sendContactMessage = function() {
    const message = document.getElementById('contactMessage').value.trim();
    if (!message) return;

    const subject = encodeURIComponent('CodeFly Language Support Request');
    const body = encodeURIComponent(message);
    window.open(`mailto:codefly@example.com?subject=${subject}&body=${body}`, '_blank');

    const modal = document.getElementById('contactModal');
    modal.innerHTML = '<div class="cm-sent">Opening email client...</div>';
    setTimeout(() => { modal.style.display = 'none'; }, 2000);
}
