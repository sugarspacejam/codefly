// Cloudflare Worker to handle GitHub OAuth Authorization Code flow
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // Helper to add CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };
        
        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // Route: /github/oauth/authorize - Exchange code for token
            if (url.pathname === '/github/oauth/authorize' && request.method === 'POST') {
                const { code, state } = await request.json();
                
                const tokenBody = new URLSearchParams();
                tokenBody.set('client_id', env.CODEFLY_GITHUB_APP_CLIENT_ID);
                tokenBody.set('client_secret', env.CODEFLY_GITHUB_APP_CLIENT_SECRET);
                tokenBody.set('code', code);
                tokenBody.set('state', state);
                
                const response = await fetch('https://github.com/login/oauth/access_token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json',
                        'User-Agent': 'CodeFly',
                    },
                    body: tokenBody.toString(),
                });
                
                const data = await response.json();
                return new Response(JSON.stringify(data), {
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders,
                    },
                });
            }

            // Route: /github/oauth/user - Get user info with token
            if (url.pathname === '/github/oauth/user' && request.method === 'POST') {
                const { access_token } = await request.json();
                
                const response = await fetch('https://api.github.com/user', {
                    headers: {
                        'Authorization': `Bearer ${access_token}`,
                        'User-Agent': 'CodeFly',
                    },
                });
                
                const data = await response.json();
                return new Response(JSON.stringify(data), {
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders,
                    },
                });
            }

            // Route: /gitlab/oauth/authorize - Exchange code for token
            if (url.pathname === '/gitlab/oauth/authorize' && request.method === 'POST') {
                const { code, state } = await request.json();
                
                const tokenBody = new URLSearchParams();
                tokenBody.set('client_id', env.CODEFLY_GITLAB_APP_APPLICATION_ID);
                tokenBody.set('client_secret', env.CODEFLY_GITLAB_APP_APPLICATION_SECRET);
                tokenBody.set('code', code);
                tokenBody.set('grant_type', 'authorization_code');
                tokenBody.set('redirect_uri', 'https://sugarspacejam.github.io/codefly/');
                
                const response = await fetch('https://gitlab.com/oauth/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: tokenBody.toString(),
                });
                
                const data = await response.json();
                return new Response(JSON.stringify(data), {
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders,
                    },
                });
            }

            // Route: /gitlab/oauth/user - Get user info with token
            if (url.pathname === '/gitlab/oauth/user' && request.method === 'POST') {
                const { access_token } = await request.json();
                
                const response = await fetch('https://gitlab.com/api/v4/user', {
                    headers: {
                        'Authorization': `Bearer ${access_token}`,
                    },
                });
                
                const data = await response.json();
                return new Response(JSON.stringify(data), {
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders,
                    },
                });
            }
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                },
            });
        }

        return new Response('CodeFly OAuth Proxy', { 
            status: 200,
            headers: corsHeaders,
        });
    },
};
