const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { generateGraph, cloneRepo } = require('./generate-graph');

const PORT = parseInt(process.env.PORT, 10) || 8090;
const WS_PORT = parseInt(process.env.WS_PORT, 10) || 8091;

// ============================================================
// GRAPH CACHE
// ============================================================
const graphCache = new Map();

// ============================================================
// RATE LIMITING — per IP, 10 generates per hour
// ============================================================
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimits.set(ip, { start: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ============================================================
// STATIC FILE SERVER + API
// ============================================================
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const httpServer = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const urlPath = urlObj.pathname;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // ---- API: Generate graph from URL or path ----
  if (urlPath === '/api/generate' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');

    if (!checkRateLimit(clientIp)) {
      res.writeHead(429);
      res.end(JSON.stringify({ error: 'Rate limit exceeded. Try again in an hour.' }));
      return;
    }

    try {
      const raw = await readBody(req);
      const { url } = JSON.parse(raw);
      if (!url) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'url is required' }));
        return;
      }

      // Check cache
      if (graphCache.has(url)) {
        res.writeHead(200);
        res.end(JSON.stringify(graphCache.get(url)));
        return;
      }

      let scanDir;
      let needsCleanup = false;

      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('git@')) {
        scanDir = cloneRepo(url);
        needsCleanup = true;
      } else {
        scanDir = path.resolve(url);
        if (!fs.existsSync(scanDir)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: `Directory not found: ${url}` }));
          return;
        }
      }

      const graph = generateGraph(scanDir);

      if (needsCleanup) {
        fs.rmSync(scanDir, { recursive: true });
      }

      graphCache.set(url, graph);

      res.writeHead(200);
      res.end(JSON.stringify(graph));
    } catch (err) {
      console.error('Generate error:', err.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ---- API: Feedback ----
  if (urlPath === '/api/feedback' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const raw = await readBody(req);
      const feedback = JSON.parse(raw);
      const feedbackFile = path.join(__dirname, 'feedback.json');
      let existing = [];
      try { existing = JSON.parse(fs.readFileSync(feedbackFile, 'utf-8')); } catch {}
      existing.push(feedback);
      fs.writeFileSync(feedbackFile, JSON.stringify(existing, null, 2));
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ---- API: List cached repos ----
  if (urlPath === '/api/repos' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    const repos = [];
    for (const [url, graph] of graphCache) {
      repos.push({
        url,
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        languages: graph.meta.languages,
        generatedAt: graph.meta.generatedAt,
      });
    }
    res.writeHead(200);
    res.end(JSON.stringify(repos));
    return;
  }

  // ---- Static files ----
  const filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);

  if (!filePath.startsWith(__dirname + path.sep) && filePath !== __dirname) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    if (urlPath === '/' || urlPath === '/index.html') {
      const html = data.toString().replace('</head>', `<meta name="ws-port" content="${WS_PORT}">\n</head>`);
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
      res.end(html);
      return;
    }
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

httpServer.listen(PORT, () => {
  console.log(`HTTP server: http://localhost:${PORT}`);
});

// ============================================================
// WEBSOCKET MULTIPLAYER SERVER
// ============================================================
const wss = new WebSocketServer({ port: WS_PORT });
const players = new Map();
let nextId = 1;

function randomColor() {
  const hue = Math.random() * 360;
  return `hsl(${Math.round(hue)}, 100%, 60%)`;
}

wss.on('connection', (ws) => {
  const playerId = nextId++;
  const playerData = {
    id: playerId,
    nickname: 'Explorer',
    color: randomColor(),
    position: { x: 0, y: 30, z: 80 },
    rotation: { yaw: 0, pitch: 0 },
  };
  players.set(playerId, { ws, data: playerData });

  console.log(`Player ${playerId} connected (${players.size} online)`);

  ws.send(JSON.stringify({
    type: 'welcome',
    playerId: playerId,
    players: Array.from(players.values()).map(p => p.data),
  }));

  broadcast({
    type: 'player_joined',
    player: playerData,
  }, playerId);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'update') {
      if (!msg.position || typeof msg.position.x !== 'number' || typeof msg.position.y !== 'number' || typeof msg.position.z !== 'number') {
        console.error(`Player ${playerId}: invalid position in update`);
        return;
      }
      if (!msg.rotation || typeof msg.rotation.yaw !== 'number' || typeof msg.rotation.pitch !== 'number') {
        console.error(`Player ${playerId}: invalid rotation in update`);
        return;
      }
      playerData.position = msg.position;
      playerData.rotation = msg.rotation;
      if (msg.nickname && typeof msg.nickname === 'string') {
        playerData.nickname = msg.nickname.slice(0, 20);
      }

      broadcast({
        type: 'player_update',
        playerId: playerId,
        position: msg.position,
        rotation: msg.rotation,
        nickname: playerData.nickname,
      }, playerId);
    }

    if (msg.type === 'set_nickname') {
      if (!msg.nickname || typeof msg.nickname !== 'string') {
        console.error(`Player ${playerId}: invalid nickname`);
        return;
      }
      playerData.nickname = msg.nickname.slice(0, 20);
      broadcast({
        type: 'player_nickname',
        playerId: playerId,
        nickname: playerData.nickname,
      });
    }

    if (msg.type === 'chat') {
      if (!msg.text || typeof msg.text !== 'string') {
        console.error(`Player ${playerId}: invalid chat text`);
        return;
      }
      broadcast({
        type: 'chat',
        playerId: playerId,
        nickname: playerData.nickname,
        text: msg.text.slice(0, 200),
      });
    }
  });

  ws.on('close', () => {
    players.delete(playerId);
    console.log(`Player ${playerId} disconnected (${players.size} online)`);
    broadcast({
      type: 'player_left',
      playerId: playerId,
    });
  });
});

function broadcast(msg, excludeId) {
  const data = JSON.stringify(msg);
  for (const [id, player] of players) {
    if (id === excludeId) continue;
    if (player.ws.readyState === 1) {
      player.ws.send(data);
    }
  }
}

console.log(`WebSocket server: ws://localhost:${WS_PORT}`);
