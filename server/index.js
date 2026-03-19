'use strict';

// ---------------------------------------------------------------------------
// Profitlord Command Center — Backend (Node 20, no external dependencies)
// Endpoints:
//   GET  /health
//   POST /execute       { command, source, ts }
//   POST /delegate      { task, soul, source }
//   POST /chat/:soul    { message, session_id }
//
// Required environment variables:
//   GH_TOKEN   — GitHub personal access token with repo write access
//   GH_OWNER   — Repository owner  (e.g. uncommonpope-png)
//   GH_REPO    — Repository name   (e.g. Profitlord)
//   PORT       — (optional) listening port, defaults to 3000
// ---------------------------------------------------------------------------

const http = require('http');
const https = require('https');

const PORT = parseInt(process.env.PORT || '3000', 10);
const GH_TOKEN = process.env.GH_TOKEN || '';
const GH_OWNER = process.env.GH_OWNER || 'uncommonpope-png';
const GH_REPO = process.env.GH_REPO || 'Profitlord';
const GH_BRANCH = process.env.GH_BRANCH || 'main';
const ALLOWED_ORIGIN = 'https://uncommonpope-png.github.io';

if (!GH_TOKEN) {
  console.warn('[WARN] GH_TOKEN is not set — GitHub writeback will be disabled.');
}

// ─── GitHub REST helpers ────────────────────────────────────────────────────

function ghRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'User-Agent': 'profitlord-server/1.0',
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + GH_TOKEN,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function ghGetFile(filePath) {
  const r = await ghRequest('GET', `/repos/${GH_OWNER}/${GH_REPO}/contents/${filePath}?ref=${GH_BRANCH}`);
  if (r.status !== 200) return null;
  return { sha: r.body.sha, content: Buffer.from(r.body.content, 'base64').toString('utf8') };
}

async function ghPutFile(filePath, message, content, sha) {
  const encoded = Buffer.from(content, 'utf8').toString('base64');
  const body = { message, content: encoded, branch: GH_BRANCH };
  if (sha) body.sha = sha;
  return ghRequest('PUT', `/repos/${GH_OWNER}/${GH_REPO}/contents/${filePath}`, body);
}

// ─── GitHub writeback ───────────────────────────────────────────────────────

async function updateState(patch) {
  if (!GH_TOKEN) { console.log('[GH] skipped — no token'); return; }
  try {
    const file = await ghGetFile('docs/state.json');
    let state = {};
    let sha;
    if (file) { state = JSON.parse(file.content); sha = file.sha; }
    const next = deepMerge(state, patch);
    next.updated_at = new Date().toISOString();
    const r = await ghPutFile(
      'docs/state.json',
      'nreal: update state.json [skip ci]',
      JSON.stringify(next, null, 2) + '\n',
      sha
    );
    if (r.status >= 200 && r.status < 300) {
      console.log('[GH] state.json updated');
    } else {
      console.error('[GH] state.json update failed', r.status, JSON.stringify(r.body).slice(0, 200));
    }
  } catch (e) {
    console.error('[GH] updateState error:', e.message);
  }
}

async function appendLedger(entry) {
  if (!GH_TOKEN) { console.log('[GH] skipped — no token'); return; }
  try {
    const file = await ghGetFile('docs/ledger.jsonl');
    const existing = file ? file.content : '';
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
    const next = existing + line;
    const r = await ghPutFile(
      'docs/ledger.jsonl',
      'nreal: append ledger.jsonl [skip ci]',
      next,
      file ? file.sha : undefined
    );
    if (r.status >= 200 && r.status < 300) {
      console.log('[GH] ledger.jsonl appended');
    } else {
      console.error('[GH] ledger.jsonl append failed', r.status, JSON.stringify(r.body).slice(0, 200));
    }
  } catch (e) {
    console.error('[GH] appendLedger error:', e.message);
  }
}

function deepMerge(target, source) {
  const out = Object.assign({}, target);
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] !== null) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ─── Request helpers ────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) reject(new Error('body too large')); });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
}

// ─── Route handlers ─────────────────────────────────────────────────────────

async function handleHealth(req, res) {
  send(res, 200, { status: 'ok', ts: new Date().toISOString(), service: 'profitlord-server' });
}

async function handleExecute(req, res) {
  let body;
  try { body = await readBody(req); } catch (e) { return send(res, 400, { error: e.message }); }

  const command = String(body.command || '').trim();
  const source = String(body.source || 'unknown').slice(0, 64);
  const ts = body.ts || new Date().toISOString();

  if (!command) return send(res, 400, { error: 'command is required' });

  console.log(`[execute] source=${source} command=${command.slice(0, 120)}`);

  // Fire-and-forget GitHub writes
  updateState({ current_task: command, health: 100 }).catch(() => {});
  appendLedger({ type: 'command', event: command, source }).catch(() => {});

  send(res, 200, {
    ok: true,
    received: { command, source, ts },
    message: 'Command received and logged.',
  });
}

async function handleChat(req, res, soul) {
  let body;
  try { body = await readBody(req); } catch (e) { return send(res, 400, { error: e.message }); }

  const message = String(body.message || '').trim();
  const sessionId = String(body.session_id || '').slice(0, 64);

  if (!message) return send(res, 400, { error: 'message is required' });

  console.log(`[chat] soul=${soul} session=${sessionId} msg=${message.slice(0, 120)}`);

  const reply = `${soul} received: "${message}". (Render brain not yet wired — state recorded.)`;

  // Fire-and-forget GitHub writes
  updateState({
    souls: {
      [soul]: {
        status: 'active',
        last_seen: new Date().toISOString(),
        last_message: message.slice(0, 200),
      },
    },
    health: 100,
  }).catch(() => {});
  appendLedger({ type: 'chat', event: message, source: soul, session_id: sessionId }).catch(() => {});

  send(res, 200, { ok: true, soul, reply, session_id: sessionId });
}

const SOUL_COLLECTOR_NAME = 'SoulCollector';
const LOG_TRUNCATE        = 120;
const MSG_TRUNCATE        = 200;
const TASK_SUMMARY_LEN    = 80;

async function handleDelegate(req, res) {
  let body;
  try { body = await readBody(req); } catch (e) { return send(res, 400, { error: e.message }); }

  const task   = String(body.task || '').trim();
  const soul   = String(body.soul || '').trim();
  const source = String(body.source || 'unknown').slice(0, 64);

  if (!task) return send(res, 400, { error: 'task is required' });
  if (!soul) return send(res, 400, { error: 'soul is required' });

  console.log(`[delegate] ${SOUL_COLLECTOR_NAME} -> soul=${soul} source=${source} task=${task.slice(0, LOG_TRUNCATE)}`);

  const now = new Date().toISOString();

  // Fire-and-forget GitHub writes
  updateState({
    souls: {
      [SOUL_COLLECTOR_NAME]: { status: 'active', last_seen: now, last_message: `Delegated to ${soul}: ${task.slice(0, LOG_TRUNCATE)}` },
      [soul]: { status: 'active', last_seen: now, last_message: task.slice(0, MSG_TRUNCATE) },
    },
    health: 100,
    current_task: `${SOUL_COLLECTOR_NAME} → ${soul}: ${task.slice(0, TASK_SUMMARY_LEN)}`,
  }).catch(() => {});
  appendLedger({
    type: 'delegate',
    event: task,
    source: SOUL_COLLECTOR_NAME,
    delegated_to: soul,
    original_source: source,
  }).catch(() => {});

  send(res, 200, {
    ok: true,
    collector: SOUL_COLLECTOR_NAME,
    soul,
    task,
    message: `Task delegated to ${soul}.`,
  });
}



const server = http.createServer(async (req, res) => {
  setCors(req, res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  try {
    if (req.method === 'GET' && path === '/health') {
      return handleHealth(req, res);
    }
    if (req.method === 'POST' && path === '/execute') {
      return handleExecute(req, res);
    }
    if (req.method === 'POST' && path === '/delegate') {
      return handleDelegate(req, res);
    }
    const chatMatch = path.match(/^\/chat\/([^/]+)$/);
    if (req.method === 'POST' && chatMatch) {
      return handleChat(req, res, decodeURIComponent(chatMatch[1]));
    }
    send(res, 404, { error: 'Not found', path });
  } catch (e) {
    console.error('[ERROR]', e);
    send(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`[profitlord-server] listening on port ${PORT}`);
  console.log(`[profitlord-server] GitHub writeback: ${GH_TOKEN ? 'enabled' : 'DISABLED (no GH_TOKEN)'}`);
  console.log(`[profitlord-server] CORS allowed origin: ${ALLOWED_ORIGIN}`);
});
