const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'codechat.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    github_id INTEGER UNIQUE NOT NULL,
    github_login TEXT NOT NULL,
    github_name TEXT,
    github_avatar TEXT,
    email TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    upgraded_at TEXT,
    repos_generated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS graphs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    repo_url TEXT NOT NULL,
    node_count INTEGER NOT NULL DEFAULT 0,
    edge_count INTEGER NOT NULL DEFAULT 0,
    languages TEXT,
    graph_data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  CREATE INDEX IF NOT EXISTS idx_graphs_user ON graphs(user_id);
  CREATE INDEX IF NOT EXISTS idx_graphs_url ON graphs(repo_url);
`);

const FREE_REPO_LIMIT = 2;

function findUserByGithubId(githubId) {
  return db.prepare('SELECT * FROM users WHERE github_id = ?').get(githubId);
}

function createUser(githubId, login, name, avatar, email) {
  const id = uuidv4();
  db.prepare(`
    INSERT INTO users (id, github_id, github_login, github_name, github_avatar, email)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, githubId, login, name, avatar, email);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function updateUser(id, login, name, avatar, email) {
  db.prepare(`
    UPDATE users SET github_login = ?, github_name = ?, github_avatar = ?, email = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(login, name, avatar, email, id);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function createSession(userId) {
  const token = uuidv4();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  return token;
}

function getUserBySession(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.* FROM users u
    JOIN sessions s ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token);
  return row;
}

function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function incrementRepoCount(userId) {
  db.prepare("UPDATE users SET repos_generated = repos_generated + 1, updated_at = datetime('now') WHERE id = ?").run(userId);
}

function canGenerateRepo(user) {
  if (user.plan === 'pro') return true;
  return user.repos_generated < FREE_REPO_LIMIT;
}

function saveGraph(userId, repoUrl, graphData) {
  const id = uuidv4();
  const nodeCount = graphData.nodes.length;
  const edgeCount = graphData.edges.length;
  const languages = JSON.stringify(graphData.meta.languages);
  db.prepare(`
    INSERT INTO graphs (id, user_id, repo_url, node_count, edge_count, languages, graph_data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, repoUrl, nodeCount, edgeCount, languages, JSON.stringify(graphData));
  return id;
}

function getGraphByUrl(repoUrl) {
  const row = db.prepare('SELECT * FROM graphs WHERE repo_url = ? ORDER BY created_at DESC LIMIT 1').get(repoUrl);
  if (!row) return null;
  return JSON.parse(row.graph_data);
}

function getUserGraphs(userId) {
  return db.prepare(`
    SELECT id, repo_url, node_count, edge_count, languages, created_at
    FROM graphs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
  `).all(userId);
}

function setUserPlan(userId, plan) {
  const upgradedAt = plan === 'pro' ? new Date().toISOString() : null;
  db.prepare(`
    UPDATE users SET plan = ?, upgraded_at = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(plan, upgradedAt, userId);
}

module.exports = {
  db,
  FREE_REPO_LIMIT,
  findUserByGithubId,
  createUser,
  updateUser,
  createSession,
  getUserBySession,
  deleteSession,
  incrementRepoCount,
  canGenerateRepo,
  saveGraph,
  getGraphByUrl,
  getUserGraphs,
  setUserPlan,
};
