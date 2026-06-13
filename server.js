const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { generateGraph, cloneRepo } = require('./generate-graph');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { CodeAgent } = require('./code-agent');

const PORT = parseInt(process.env.PORT, 10) || 8090;
const WS_PORT = parseInt(process.env.WS_PORT, 10) || 8091;

// ============================================================
// GRAPH CACHE
// ============================================================
const graphCache = new Map();
const roomMessages = new Map();

// ============================================================
// CODE AGENT SYSTEM
// ============================================================
const agents = new Map();
let nextAgentId = 1;

function createAgent(config) {
    const agentId = config.id || `agent-${nextAgentId++}`;
    const agentConfig = {
        id: agentId,
        name: config.name || 'Agent',
        role: config.role || 'assistant',
        systemPrompt: config.systemPrompt,
        llm: {
            baseUrl: config.llm?.baseUrl || 'http://10.0.0.6:11434',
            model: config.llm?.model || 'llama3.2'
        }
    };
    
    const agent = new CodeAgent(agentConfig);
    agent.setPosition(
        config.position?.x || 0,
        config.position?.y || 30,
        config.position?.z || 80
    );
    
    agents.set(agentId, agent);
    console.log(`Created agent: ${agentId} (${agentConfig.name})`);
    return agent;
}

function getAgent(agentId) {
    return agents.get(agentId);
}

function getAllAgents() {
    return Array.from(agents.values()).map(agent => agent.toJSON());
}

function removeAgent(agentId) {
    const removed = agents.delete(agentId);
    if (removed) {
        console.log(`Removed agent: ${agentId}`);
    }
    return removed;
}

// ============================================================
// MONETIZATION + RATE LIMITING — plan-aware quotas
// ============================================================
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;
const PLAN_LIMITS = {
  free: {
    maxGeneratesPerWindow: 10,
    maxFilesPerGraph: 12000,
    maxNodesPerGraph: 12000,
  },
  pro: {
    maxGeneratesPerWindow: 200,
    maxFilesPerGraph: 100000,
    maxNodesPerGraph: 100000,
  },
};

function resolvePlan(req) {
  const headerValue = req.headers['x-codefly-plan'];
  if (typeof headerValue === 'string' && headerValue.toLowerCase() === 'pro') {
    return 'pro';
  }
  return 'free';
}

function getRoomMessages(roomId) {
  const key = String(roomId || '').trim();
  if (!roomMessages.has(key)) {
    roomMessages.set(key, []);
  }
  return roomMessages.get(key);
}

function checkRateLimit(ip, plan) {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const key = `${ip}:${plan}`;
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    const next = { start: now, count: 1 };
    rateLimits.set(key, next);
    return {
      allowed: true,
      usage: {
        plan,
        windowMs: RATE_LIMIT_WINDOW,
        used: next.count,
        limit: limits.maxGeneratesPerWindow,
        remaining: Math.max(0, limits.maxGeneratesPerWindow - next.count),
        resetAt: new Date(next.start + RATE_LIMIT_WINDOW).toISOString(),
      },
    };
  }
  if (entry.count >= limits.maxGeneratesPerWindow) {
    return {
      allowed: false,
      usage: {
        plan,
        windowMs: RATE_LIMIT_WINDOW,
        used: entry.count,
        limit: limits.maxGeneratesPerWindow,
        remaining: 0,
        resetAt: new Date(entry.start + RATE_LIMIT_WINDOW).toISOString(),
      },
    };
  }
  entry.count++;
  return {
    allowed: true,
    usage: {
      plan,
      windowMs: RATE_LIMIT_WINDOW,
      used: entry.count,
      limit: limits.maxGeneratesPerWindow,
      remaining: Math.max(0, limits.maxGeneratesPerWindow - entry.count),
      resetAt: new Date(entry.start + RATE_LIMIT_WINDOW).toISOString(),
    },
  };
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
    const plan = resolvePlan(req);
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    const quotaCheck = checkRateLimit(clientIp, plan);
    if (!quotaCheck.allowed) {
      res.writeHead(429);
      res.end(JSON.stringify({
        error: 'Rate limit exceeded. Try again after reset or upgrade your plan.',
        usage: quotaCheck.usage,
        monetization: {
          plan,
          upgradeRequired: plan === 'free',
          upgradePath: '/pricing',
        },
      }));
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

      const totalFiles = Number(graph.meta && graph.meta.totalFiles ? graph.meta.totalFiles : graph.nodes.length);
      const totalNodes = Array.isArray(graph.nodes) ? graph.nodes.length : 0;
      if (totalFiles > limits.maxFilesPerGraph || totalNodes > limits.maxNodesPerGraph) {
        res.writeHead(402);
        res.end(JSON.stringify({
          error: `Plan limit exceeded for ${plan}. Upgrade required for larger repositories.`,
          usage: quotaCheck.usage,
          monetization: {
            plan,
            upgradeRequired: true,
            upgradePath: '/pricing',
            limits,
            current: {
              totalFiles,
              totalNodes,
            },
          },
        }));
        return;
      }

      graphCache.set(url, graph);

      res.writeHead(200);
      res.end(JSON.stringify({
        ...graph,
        usage: quotaCheck.usage,
        monetization: {
          plan,
          limits,
          upgradePath: '/pricing',
          upgradeRequired: false,
        },
      }));
    } catch (err) {
      console.error('Generate error:', err.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ---- API: Room messages ----
  const roomMessageMatch = urlPath.match(/^\/api\/rooms\/([^/]+)\/messages$/);
  if (roomMessageMatch) {
    const roomId = decodeURIComponent(roomMessageMatch[1]);
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'GET') {
      const messages = getRoomMessages(roomId);
      res.writeHead(200);
      res.end(JSON.stringify({ roomId, messages }));
      return;
    }

    if (req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const payload = JSON.parse(raw || '{}');
        if (!payload || typeof payload.text !== 'string' || !payload.text.trim()) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'text is required' }));
          return;
        }
        const nickname = typeof payload.nickname === 'string' && payload.nickname.trim()
          ? payload.nickname.trim().slice(0, 32)
          : 'Explorer';
        const entry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          roomId,
          nickname,
          text: payload.text.trim().slice(0, 300),
          createdAt: new Date().toISOString(),
        };
        const messages = getRoomMessages(roomId);
        messages.push(entry);
        while (messages.length > 200) {
          messages.shift();
        }
        res.writeHead(201);
        res.end(JSON.stringify(entry));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
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

  // ---- API: Dead code detection ----
  if (urlPath === '/api/deadcode' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const raw = await readBody(req);
      const { url } = JSON.parse(raw);
      if (!url) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'url is required' }));
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

      const results = { knip: null, depcheck: null, errors: [] };

      try {
        const { stdout: knipOutput, stderr: knipStderr } = await execAsync('npx knip', { cwd: scanDir, timeout: 60000 });
        results.knip = knipOutput || knipStderr;
      } catch (err) {
        results.knip = err.stdout || err.stderr || err.message;
      }

      try {
        const { stdout: depcheckOutput, stderr: depcheckStderr } = await execAsync('npx depcheck', { cwd: scanDir, timeout: 60000 });
        results.depcheck = depcheckOutput || depcheckStderr;
      } catch (err) {
        results.depcheck = err.stdout || err.stderr || err.message;
      }

      if (needsCleanup) {
        fs.rmSync(scanDir, { recursive: true });
      }

      res.writeHead(200);
      res.end(JSON.stringify(results));
    } catch (err) {
      console.error('Dead code detection error:', err.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ---- API: Agent management ----
  if (urlPath === '/api/agents' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(getAllAgents()));
    return;
  }

  if (urlPath === '/api/agents' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const raw = await readBody(req);
      const config = JSON.parse(raw);
      const agent = createAgent(config);
      broadcastAgentJoin(agent.toJSON());
      res.writeHead(201);
      res.end(JSON.stringify(agent.toJSON()));
    } catch (err) {
      console.error('Agent creation error:', err.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  const agentMatch = urlPath.match(/^\/api\/agents\/([^/]+)$/);
  if (agentMatch && req.method === 'DELETE') {
    const agentId = decodeURIComponent(agentMatch[1]);
    res.setHeader('Content-Type', 'application/json');
    const removed = removeAgent(agentId);
    if (removed) {
      broadcastAgentLeave(agentId);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Agent not found' }));
    }
    return;
  }

  if (urlPath.match(/^\/api\/agents\/[^/]+\/chat$/) && req.method === 'POST') {
    const agentId = decodeURIComponent(urlPath.split('/')[3]);
    res.setHeader('Content-Type', 'application/json');
    try {
      const raw = await readBody(req);
      const { message, codeContext } = JSON.parse(raw);
      const agent = getAgent(agentId);
      if (!agent) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Agent not found' }));
        return;
      }
      const response = await agent.processMessage(message, codeContext);
      res.writeHead(200);
      res.end(JSON.stringify({ response }));
    } catch (err) {
      console.error('Agent chat error:', err.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
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
const rooms = new Map();
let nextId = 1;

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      players: new Map(),
    });
  }
  return rooms.get(roomId);
}

function removeRoomIfEmpty(roomId) {
  const room = rooms.get(roomId);
  if (room && room.players.size === 0) {
    rooms.delete(roomId);
  }
}

function randomColor() {
  const hue = Math.random() * 360;
  return `hsl(${Math.round(hue)}, 100%, 60%)`;
}

wss.on('connection', (ws, req) => {
  const reqUrl = new URL(req.url || '/', `ws://${req.headers.host || `localhost:${WS_PORT}`}`);
  const roomPathMatch = reqUrl.pathname.match(/^\/room\/(.+)$/);
  const roomId = roomPathMatch ? decodeURIComponent(roomPathMatch[1]) : 'global';
  const room = getOrCreateRoom(roomId);

  const playerId = nextId++;
  const playerData = {
    id: playerId,
    nickname: 'Explorer',
    color: randomColor(),
    position: { x: 0, y: 30, z: 80 },
    rotation: { yaw: 0, pitch: 0 },
  };
  room.players.set(playerId, { ws, data: playerData });
  ws._roomId = roomId;

  console.log(`Player ${playerId} connected to room ${roomId} (${room.players.size} online)`);

  ws.send(JSON.stringify({
    type: 'welcome',
    playerId: playerId,
    roomId,
    players: Array.from(room.players.values()).map(p => p.data),
    agents: getAllAgents(),
  }));

  broadcastToRoom(roomId, {
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

      broadcastToRoom(roomId, {
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
      broadcastToRoom(roomId, {
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
      broadcastToRoom(roomId, {
        type: 'chat',
        playerId: playerId,
        nickname: playerData.nickname,
        text: msg.text.slice(0, 200),
      });
    }
  });

  ws.on('close', () => {
    room.players.delete(playerId);
    console.log(`Player ${playerId} disconnected from room ${roomId} (${room.players.size} online)`);
    broadcastToRoom(roomId, {
      type: 'player_left',
      playerId: playerId,
    });
    removeRoomIfEmpty(roomId);
  });
});

function broadcastToRoom(roomId, msg, excludeId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(msg);
  for (const [id, player] of room.players) {
    if (id === excludeId) continue;
    if (player.ws.readyState === 1) {
      player.ws.send(data);
    }
  }
}

function broadcastAgentJoin(agentData) {
  for (const [roomId, room] of rooms) {
    broadcastToRoom(roomId, {
      type: 'agent_joined',
      agent: agentData,
    });
  }
}

function broadcastAgentLeave(agentId) {
  for (const [roomId, room] of rooms) {
    broadcastToRoom(roomId, {
      type: 'agent_left',
      agentId: agentId,
    });
  }
}

console.log(`WebSocket server: ws://localhost:${WS_PORT}`);
