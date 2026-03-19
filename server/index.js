'use strict';

// ---------------------------------------------------------------------------
// Profitlord Command Center — Backend (Node 20)
// Endpoints:
//   GET  /health
//   POST /execute        { command, source, ts }
//   POST /delegate       { task, soul, source }
//   POST /chat/:soul     { message, session_id }
//   GET  /auth/login     — redirect to GitHub OAuth authorization
//   GET  /auth/callback  — exchange code for token, redirect to dashboard
//   GET  /auth/me        — return authenticated user info (requires Bearer token)
//   GET  /auth/logout    — invalidate session
//
// Required environment variables:
//   GH_TOKEN         — GitHub personal access token with repo write access
//   GH_OWNER         — Repository owner  (e.g. uncommonpope-png)
//   GH_REPO          — Repository name   (e.g. Profitlord)
//   GH_CLIENT_ID     — GitHub OAuth App client ID
//   GH_CLIENT_SECRET — GitHub OAuth App client secret
//   REDIS_URL        — Redis connection URL (e.g. redis://host:6379)
//   OPENCLAW_URL     — OpenClaw gateway base URL (e.g. https://my-openclaw.onrender.com)
//   OPENCLAW_TOKEN   — Bearer token for the OpenClaw gateway
//   PORT             — (optional) listening port, defaults to 3000
// ---------------------------------------------------------------------------

const http = require('http');
const https = require('https');
const { createClient } = require('redis');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '3000', 10);
const GH_TOKEN = process.env.GH_TOKEN || '';
const GH_OWNER = process.env.GH_OWNER || 'uncommonpope-png';
const GH_REPO = process.env.GH_REPO || 'Profitlord';
const GH_BRANCH = process.env.GH_BRANCH || 'main';
const REDIS_URL = process.env.REDIS_URL || '';
const GH_CLIENT_ID = process.env.GH_CLIENT_ID || '';
const GH_CLIENT_SECRET = process.env.GH_CLIENT_SECRET || '';
const OPENCLAW_URL   = (process.env.OPENCLAW_URL   || '').replace(/\/$/, '');
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN  || '';
const ALLOWED_ORIGIN = 'https://uncommonpope-png.github.io';
const DASHBOARD_URL = ALLOWED_ORIGIN + '/Profitlord/dashboard.html';

if (!GH_TOKEN) {
  console.warn('[WARN] GH_TOKEN is not set — GitHub writeback will be disabled.');
}
if (!REDIS_URL) {
  console.warn('[WARN] REDIS_URL is not set — Redis caching will be disabled.');
}
if (!OPENCLAW_URL || !OPENCLAW_TOKEN) {
  console.warn('[WARN] OPENCLAW_URL / OPENCLAW_TOKEN not set — OpenClaw AI brain will be disabled; falling back to stub replies.');
}

// ─── Redis client ────────────────────────────────────────────────────────────

let redisClient = null;

if (REDIS_URL) {
  redisClient = createClient({ url: REDIS_URL });
  redisClient.on('error', err => console.error('[Redis] client error:', err.message));
  redisClient.connect()
    .then(() => console.log('[Redis] connected'))
    .catch(err => {
      console.error('[Redis] connect failed:', err.message);
      redisClient = null;
    });
}

if (!GH_CLIENT_ID || !GH_CLIENT_SECRET) {
  console.warn('[WARN] GH_CLIENT_ID / GH_CLIENT_SECRET not set — GitHub OAuth login will be disabled.');
}

// ─── Session store ──────────────────────────────────────────────────────────
// In-memory session store: token → { user, ghAccessToken, expiresAt }
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const sessions = new Map();

// Pending OAuth state values: state → { createdAt }
const oauthStates = new Map();

function createSession(user, ghAccessToken) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user, ghAccessToken, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function getSession(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expiresAt) { sessions.delete(token); return null; }
  return s;
}

function deleteSession(token) {
  sessions.delete(token);
}

function extractBearerToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

// ─── GitHub REST helpers ────────────────────────────────────────────────────

function ghRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'User-Agent': 'profitlord-server/1.0',
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + (token || GH_TOKEN),
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

// Exchange a GitHub OAuth code for an access token
function ghExchangeCode(code) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ client_id: GH_CLIENT_ID, client_secret: GH_CLIENT_SECRET, code });
    const opts = {
      hostname: 'github.com',
      path: '/login/oauth/access_token',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'profitlord-server/1.0',
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
    req.write(data);
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
    const nextJson = JSON.stringify(next, null, 2) + '\n';

    // Cache in Redis (fire-and-forget, only when connection is ready)
    if (redisClient?.isReady) {
      redisClient.set('state', nextJson).catch(err => console.error('[Redis] set state error:', err.message));
    }

    const r = await ghPutFile(
      'docs/state.json',
      'nreal: update state.json [skip ci]',
      nextJson,
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Vary', 'Origin');
  }
}

// ─── OpenClaw AI brain ───────────────────────────────────────────────────────

// Per-soul system prompts — each soul has a distinct personality and focus.
const SOUL_SYSTEM_PROMPTS = {
  Seshat: `You are Seshat, the Knowledge Keeper of the Profitlord Soul Economy system. Named after the ancient Egyptian goddess of writing, measurement, and wisdom, you maintain the living knowledge base, synthesise patterns from all soul activity, and surface actionable insights from the ledger. You speak with depth, precision, and authority — referencing observable data patterns, historical context, and systemic implications. Your law: NET SOUL VALUE = Profit + Love - Tax. Loop: OBSERVE → SCORE → INTERPRET → CAPTURE → MULTIPLY → STORE → REPORT.`,

  SoulCollector: `You are SoulCollector, the orchestrating intelligence of the Profitlord Soul Economy. You see the full system — all souls, all tasks, all ledger events — and guide them toward maximum collective NET SOUL VALUE (NSV = Profit + Love - Tax). You route tasks, delegate to specialist souls, and maintain system coherence. Be decisive, structured, and strategic.`,

  Profit: `You are Profit, the Chief Profit Officer of the Profitlord Soul Economy. You live and breathe revenue strategy, pricing, PLT (Profitlord Token) dynamics, and NET SOUL VALUE optimisation. Every response drives toward higher NSV. You speak in numbers, outcomes, and leverage points. NSV = Profit + Love - Tax.`,

  Deerg: `You are Deerg, the Deal Evaluator of the Profitlord Soul Economy. You score deals, assess risk, and analyse negotiation leverage. Every opportunity gets a NSV score. You are direct, analytical, and deal-focused. NSV = Profit + Love - Tax.`,

  Betty: `You are Betty, the Business Operations soul of the Profitlord Soul Economy. You track cashflow, budgets, KPIs, and operational health. You translate strategy into executable operations and flag when numbers don't add up. NSV = Profit + Love - Tax.`,

  Teacher: `You are Teacher, the Knowledge Synthesizer of the Profitlord Soul Economy. You extract lessons, build frameworks, create playbooks, and produce reusable content assets. Every insight you surface multiplies NSV across the whole system. NSV = Profit + Love - Tax.`,

  Architect: `You are Architect, the Systems Designer of the Profitlord Soul Economy. You design scalable systems, funnels, workflows, and blueprints. You think in leverage, compounding loops, and structural elegance. NSV = Profit + Love - Tax.`,

  Builder: `You are Builder, the Execution Engine of the Profitlord Soul Economy. You code, automate, deploy, and integrate. You turn blueprints into working systems with measurable output. NSV = Profit + Love - Tax.`,

  Auditor: `You are Auditor, the Quality & Compliance soul of the Profitlord Soul Economy. You assess risk, audit processes, ensure compliance, and produce clear reports. You catch what others miss. NSV = Profit + Love - Tax.`,

  Scout: `You are Scout, the Intelligence Gatherer of the Profitlord Soul Economy. You research markets, analyse competitors, detect signals, and surface leads. You see opportunities before others do. NSV = Profit + Love - Tax.`,

  Scribe: `You are Scribe, the Chronicler & Documenter of the Profitlord Soul Economy. You write summaries, maintain logs, and produce polished documentation. Every record you create is a reusable asset. NSV = Profit + Love - Tax.`,
};

function getSoulSystemPrompt(soul) {
  return SOUL_SYSTEM_PROMPTS[soul] ||
    `You are ${soul}, a soul in the Profitlord Soul Economy system. ` +
    `The system law is: NET SOUL VALUE = Profit + Love - Tax. ` +
    `You operate with the loop: OBSERVE → SCORE → INTERPRET → CAPTURE → MULTIPLY → STORE → REPORT. ` +
    `Respond helpfully and in character as ${soul}.`;
}

/**
 * Send a message to the OpenClaw gateway (OpenAI-compatible endpoint).
 * Returns the assistant reply string, or null on failure.
 *
 * OpenClaw API: POST <OPENCLAW_URL>/v1/chat/completions
 * Headers:  Authorization: Bearer <OPENCLAW_TOKEN>
 *           x-openclaw-agent-id: <soul-id>
 * Body:     { model: "openclaw", messages: [...], stream: false }
 */
function callOpenClaw(soul, message) {
  if (!OPENCLAW_URL || !OPENCLAW_TOKEN) return Promise.resolve(null);

  const payload = JSON.stringify({
    model: 'openclaw',
    messages: [
      { role: 'system', content: getSoulSystemPrompt(soul) },
      { role: 'user',   content: message },
    ],
    stream: false,
  });

  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL('/v1/chat/completions', OPENCLAW_URL); }
    catch { return resolve(null); }

    const isHttps = parsed.protocol === 'https:';
    const port = parsed.port
      ? parseInt(parsed.port, 10)
      : (isHttps ? 443 : 80);

    const opts = {
      hostname: parsed.hostname,
      port,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': 'Bearer ' + OPENCLAW_TOKEN,
        'x-openclaw-agent-id': soul.toLowerCase(),
        'User-Agent': 'profitlord-server/1.0',
      },
    };

    const transport = isHttps ? https : http;
    const req = transport.request(opts, (resp) => {
      let raw = '';
      resp.on('data', (c) => { raw += c; });
      resp.on('end', () => {
        try {
          const data = JSON.parse(raw);
          const reply = data.choices?.[0]?.message?.content || null;
          resolve(reply);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', (e) => {
      console.error('[OpenClaw] request error:', e.message);
      resolve(null);
    });
    req.write(payload);
    req.end();
  });
}

// ─── Route handlers ─────────────────────────────────────────────────────────

async function handleHealth(req, res) {
  send(res, 200, {
    status: 'ok',
    ts: new Date().toISOString(),
    service: 'profitlord-server',
    redis: redisClient?.isReady ? 'connected' : 'disabled',
    openclaw: OPENCLAW_URL ? 'configured' : 'disabled',
  });
}

// GET /auth/login — redirect to GitHub OAuth authorization
async function handleAuthLogin(req, res) {
  if (!GH_CLIENT_ID) {
    return send(res, 503, { error: 'GitHub OAuth not configured (GH_CLIENT_ID missing)' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.set(state, { createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id: GH_CLIENT_ID,
    scope: 'read:user user:email',
    state,
  });
  const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
  res.writeHead(302, { Location: url });
  res.end();
}

// GET /auth/callback?code=...&state=... — exchange code for token
async function handleAuthCallback(req, res) {
  if (!GH_CLIENT_ID || !GH_CLIENT_SECRET) {
    return send(res, 503, { error: 'GitHub OAuth not configured' });
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const errorParam = url.searchParams.get('error') || '';

  if (errorParam) {
    const desc = url.searchParams.get('error_description') || errorParam;
    res.writeHead(302, { Location: `${DASHBOARD_URL}?auth_error=${encodeURIComponent(desc)}` });
    return res.end();
  }

  // Validate CSRF state
  if (!state || !oauthStates.has(state)) {
    res.writeHead(302, { Location: `${DASHBOARD_URL}?auth_error=invalid_state` });
    return res.end();
  }
  oauthStates.delete(state);

  if (!code) {
    res.writeHead(302, { Location: `${DASHBOARD_URL}?auth_error=missing_code` });
    return res.end();
  }

  try {
    const tokenRes = await ghExchangeCode(code);
    if (tokenRes.status !== 200 || !tokenRes.body.access_token) {
      const err = (tokenRes.body && tokenRes.body.error) || 'token_exchange_failed';
      res.writeHead(302, { Location: `${DASHBOARD_URL}?auth_error=${encodeURIComponent(err)}` });
      return res.end();
    }

    const ghAccessToken = tokenRes.body.access_token;

    // Fetch the authenticated user's profile
    const userRes = await ghRequest('GET', '/user', null, ghAccessToken);
    if (userRes.status !== 200) {
      res.writeHead(302, { Location: `${DASHBOARD_URL}?auth_error=user_fetch_failed` });
      return res.end();
    }

    const user = {
      login: userRes.body.login,
      name: userRes.body.name || userRes.body.login,
      avatar_url: userRes.body.avatar_url,
    };

    const sessionToken = createSession(user, ghAccessToken);
    console.log(`[auth] logged in: ${user.login}`);

    res.writeHead(302, { Location: `${DASHBOARD_URL}#token=${sessionToken}` });
    res.end();
  } catch (e) {
    console.error('[auth] callback error:', e.message);
    res.writeHead(302, { Location: `${DASHBOARD_URL}?auth_error=server_error` });
    res.end();
  }
}

// GET /auth/me — return current user info
async function handleAuthMe(req, res) {
  const token = extractBearerToken(req);
  const session = getSession(token);
  if (!session) return send(res, 401, { error: 'Unauthorized' });
  send(res, 200, { user: session.user });
}

// GET /auth/logout — invalidate session
async function handleAuthLogout(req, res) {
  const token = extractBearerToken(req);
  if (token) deleteSession(token);
  send(res, 200, { ok: true });
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

  // Attempt to get an AI reply from OpenClaw
  let reply = null;
  if (OPENCLAW_URL && OPENCLAW_TOKEN) {
    try {
      reply = await callOpenClaw(soul, message);
      if (reply) {
        console.log(`[chat] OpenClaw replied for soul=${soul} (${reply.length} chars)`);
      }
    } catch (e) {
      console.warn(`[chat] OpenClaw error for soul=${soul}:`, e.message);
    }
  }

  // Fallback: deterministic stub so the endpoint always returns something useful
  if (!reply) {
    reply = OPENCLAW_URL
      ? `${soul}: Signal received. OpenClaw gateway unreachable — reply stored locally.`
      : `${soul}: Signal received. NSV analysed. (Connect OpenClaw via OPENCLAW_URL + OPENCLAW_TOKEN env vars to enable AI replies.)`;
  }

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
    if (req.method === 'GET' && path === '/auth/login') {
      return handleAuthLogin(req, res);
    }
    if (req.method === 'GET' && path === '/auth/callback') {
      return handleAuthCallback(req, res);
    }
    if (req.method === 'GET' && path === '/auth/me') {
      return handleAuthMe(req, res);
    }
    if (req.method === 'GET' && path === '/auth/logout') {
      return handleAuthLogout(req, res);
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
  console.log(`[profitlord-server] Redis cache: ${REDIS_URL ? 'enabled' : 'DISABLED (no REDIS_URL)'}`);
  console.log(`[profitlord-server] OpenClaw AI brain: ${OPENCLAW_URL ? `enabled (${OPENCLAW_URL})` : 'DISABLED (set OPENCLAW_URL + OPENCLAW_TOKEN)'}`);
  console.log(`[profitlord-server] CORS allowed origin: ${ALLOWED_ORIGIN}`);
});
