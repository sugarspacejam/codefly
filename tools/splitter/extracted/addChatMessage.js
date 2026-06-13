function addChatMessage(text, color) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.style.color = color || '#ccc';
    div.style.marginBottom = '2px';
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    // Keep max 50 messages
    while (container.children.length > 50) {
        container.removeChild(container.firstChild);
    }
}
