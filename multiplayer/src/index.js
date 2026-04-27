// ============================================================
// CodeFly Multiplayer — Cloudflare Durable Objects
// Each repo URL = one Room Durable Object
// ============================================================

export { Room } from './room.js';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
            });
        }

        // Route: /room/:roomId  (WebSocket upgrade)
        const match = url.pathname.match(/^\/room\/(.+)$/);
        if (!match) {
            return new Response('CodeFly Multiplayer — connect via /room/:repoUrl', { status: 200 });
        }

        const roomId = decodeURIComponent(match[1]);
        const roomObjectId = env.ROOMS.idFromName(roomId);
        const roomObject = env.ROOMS.get(roomObjectId);

        return roomObject.fetch(request);
    },
};
