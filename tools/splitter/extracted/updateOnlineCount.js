function updateOnlineCount() {
    document.getElementById('onlineCount').textContent = remotePlayers.size + 1;
    const list = document.getElementById('playerListItems');
    list.innerHTML = `<div class="player-item" style="color:#0f8">${escapeHtml(myNickname)} (you)</div>`;
    for (const [id, rp] of remotePlayers) {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.style.color = '#8ff';
        div.textContent = rp.nickname; // textContent is already safe
        list.appendChild(div);
    }
}
