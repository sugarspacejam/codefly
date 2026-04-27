// ============================================================
// Room Durable Object — one instance per repo URL
// Handles WebSocket connections, presence broadcast, chat
// ============================================================

const PRESENCE_THROTTLE_MS = 80;

export class Room {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.sessions = new Map(); // connId -> { ws, presence }
        this.lastBroadcast = 0;
    }

    async fetch(request) {
        const upgradeHeader = request.headers.get('Upgrade');
        if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
            return new Response('Expected WebSocket upgrade', { status: 426 });
        }

        const [client, server] = Object.values(new WebSocketPair());
        this.state.acceptWebSocket(server);

        const connId = crypto.randomUUID();
        this.sessions.set(connId, { ws: server, presence: null });
        server._connId = connId;

        return new Response(null, {
            status: 101,
            webSocket: client,
            headers: { 'Access-Control-Allow-Origin': '*' },
        });
    }

    async webSocketMessage(ws, rawMsg) {
        const connId = ws._connId;
        if (!connId || !this.sessions.has(connId)) return;

        let msg;
        try {
            msg = JSON.parse(rawMsg);
        } catch {
            return;
        }

        if (!msg.type) return;

        if (msg.type === 'presence') {
            // Update stored presence for this connection
            this.sessions.get(connId).presence = {
                id: connId,
                x: msg.x,
                y: msg.y,
                z: msg.z,
                yaw: msg.yaw,
                nickname: msg.nickname || 'anon',
                color: msg.color || '#00ff88',
                nodeId: msg.nodeId || null,
            };

            // Broadcast full presence snapshot to everyone
            this._broadcastPresenceSnapshot(connId);
        } else if (msg.type === 'chat') {
            if (!msg.text || typeof msg.text !== 'string') return;
            const chatMsg = JSON.stringify({
                type: 'chat',
                id: connId,
                nickname: msg.nickname || 'anon',
                color: msg.color || '#00ff88',
                text: msg.text.slice(0, 300),
                ts: Date.now(),
            });
            this._broadcast(chatMsg, null);
        }
    }

    async webSocketClose(ws) {
        const connId = ws._connId;
        if (!connId) return;
        this.sessions.delete(connId);
        this._broadcastPresenceSnapshot(null);
        this._broadcast(JSON.stringify({ type: 'leave', id: connId }), null);
    }

    async webSocketError(ws) {
        const connId = ws._connId;
        if (connId) this.sessions.delete(connId);
    }

    _broadcastPresenceSnapshot(excludeId) {
        const all = [];
        for (const [id, session] of this.sessions) {
            if (session.presence) all.push(session.presence);
        }
        const msg = JSON.stringify({ type: 'presence_snapshot', users: all });
        this._broadcast(msg, excludeId);
    }

    _broadcast(msg, excludeId) {
        for (const [id, session] of this.sessions) {
            if (id === excludeId) continue;
            try {
                session.ws.send(msg);
            } catch {
                this.sessions.delete(id);
            }
        }
    }
}
