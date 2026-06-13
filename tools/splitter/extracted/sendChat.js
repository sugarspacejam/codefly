function sendChat(text) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'chat', text, nickname: myNickname, color: myColor }));
    addChatMessage(`${myNickname}: ${text}`, '#0f8');
}
