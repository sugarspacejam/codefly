// Cloudflare Worker to proxy GitHub Device Flow endpoints for CORS
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
            });
        }

        // Route: /github/login/device/code
        if (url.pathname === '/github/login/device/code' && request.method === 'POST') {
            const body = await request.text();
            const response = await fetch('https://github.com/login/device/code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'CodeFly',
                },
                body,
            });
            
            const data = await response.json();
            return new Response(JSON.stringify(data), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Route: /github/login/oauth/access_token
        if (url.pathname === '/github/login/oauth/access_token' && request.method === 'POST') {
            const body = await request.text();
            const response = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'CodeFly',
                },
                body,
            });
            
            const data = await response.json();
            return new Response(JSON.stringify(data), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        return new Response('CodeFly OAuth Proxy', { status: 200 });
    },
};
