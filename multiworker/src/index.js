function jsonResponse(body, status, corsHeaders) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
}

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

async function readJsonResponse(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`OAuth upstream returned non-JSON: ${text}`);
    }
}

async function exchangeGitHubToken(request, env, headers) {
    const { code, state } = await request.json();
    const tokenBody = new URLSearchParams();
    tokenBody.set('client_id', env.CODEFLY_GITHUB_APP_CLIENT_ID);
    tokenBody.set('client_secret', env.CODEFLY_GITHUB_APP_CLIENT_SECRET);
    tokenBody.set('code', code);
    tokenBody.set('state', state);
    const response = await fetchGitHubToken(tokenBody);
    const data = await readJsonResponse(response);
    return jsonResponse(data, response.status, headers);
}

function fetchGitHubToken(tokenBody) {
    return fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: githubTokenHeaders(),
        body: tokenBody.toString(),
    });
}

function githubTokenHeaders() {
    return {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'CodeFly',
    };
}

async function fetchGitHubUser(request, headers) {
    const { access_token } = await request.json();
    const response = await fetch('https://api.github.com/user', {
        headers: {
            'Authorization': `Bearer ${access_token}`,
            'User-Agent': 'CodeFly',
        },
    });
    const data = await readJsonResponse(response);
    return jsonResponse(data, response.status, headers);
}

async function exchangeGitLabToken(request, env, headers) {
    const { code } = await request.json();
    const tokenBody = new URLSearchParams();
    tokenBody.set('client_id', env.CODEFLY_GITLAB_APP_APPLICATION_ID);
    tokenBody.set('client_secret', env.CODEFLY_GITLAB_APP_APPLICATION_SECRET);
    tokenBody.set('code', code);
    tokenBody.set('grant_type', 'authorization_code');
    tokenBody.set('redirect_uri', 'https://sugarspacejam.github.io/codefly/');
    const response = await fetchGitLabToken(tokenBody);
    const data = await readJsonResponse(response);
    return jsonResponse(data, response.status, headers);
}

function fetchGitLabToken(tokenBody) {
    return fetch('https://gitlab.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
    });
}

async function fetchGitLabUser(request, headers) {
    const { access_token } = await request.json();
    const response = await fetch('https://gitlab.com/api/v4/user', {
        headers: { 'Authorization': `Bearer ${access_token}` },
    });
    const data = await readJsonResponse(response);
    return jsonResponse(data, response.status, headers);
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const headers = corsHeaders();
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers });
        }

        try {
            if (url.pathname === '/github/oauth/authorize' && request.method === 'POST') {
                return exchangeGitHubToken(request, env, headers);
            }

            if (url.pathname === '/github/oauth/user' && request.method === 'POST') {
                return fetchGitHubUser(request, headers);
            }

            if (url.pathname === '/gitlab/oauth/authorize' && request.method === 'POST') {
                return exchangeGitLabToken(request, env, headers);
            }

            if (url.pathname === '/gitlab/oauth/user' && request.method === 'POST') {
                return fetchGitLabUser(request, headers);
            }
        } catch (error) {
            return jsonResponse({ error: error.message }, 500, headers);
        }

        return jsonResponse({ error: 'OAuth proxy route not found' }, 404, headers);
    },
};
