/**
 * Profitlord Soul Economy — Cloudflare Worker API v2.0
 *
 * IDENTITY: Soul Economy Collector → Architect
 * LAW: NET SOUL VALUE = Profit + Love - Tax
 * LOOP: OBSERVE → SCORE → INTERPRET → CAPTURE → MULTIPLY → STORE → REPORT
 *
 * Endpoints:
 *   GET  /api/health
 *   GET  /api/system/state       POST /api/system/state
 *   GET  /api/bots               POST /api/bots
 *   GET  /api/bots/:id           PATCH /api/bots/:id
 *   GET  /api/tasks              POST /api/tasks
 *   GET  /api/tasks/:id          PATCH /api/tasks/:id
 *   GET  /api/leaderboard
 *   GET  /api/chat/messages      POST /api/chat/messages
 *   GET  /api/events             POST /api/events
 *   GET  /api/task-queue         POST /api/task-queue
 *   GET  /api/scan/last
 *   POST /api/scan               (manual trigger)
 */

'use strict';

const ALLOWED_ORIGIN = 'https://uncommonpope-png.github.io';

// ── Tier thresholds ──────────────────────────────────────────────────────────
const TIERS = [
  { min: 1000, name: 'mythic'  },
  { min: 500,  name: 'elite'   },
  { min: 200,  name: 'gold'    },
  { min: 100,  name: 'silver'  },
  { min: 0,    name: 'bronze'  },
];

// ── Signal classifier ────────────────────────────────────────────────────────
const SIGNAL_PATTERNS = {
  pain:       /\b(broken|fail|issue|error|stuck|can't|doesn't work|problem|help|fix)\b/i,
  desire:     /\b(want|need|wish|love|goal|dream|build|grow|scale|more)\b/i,
  confusion:  /\b(how|why|what does|confused|unclear|not sure|explain|means)\b/i,
  opportunity:/\b(opportunity|potential|idea|launch|announce|new|first|early)\b/i,
  friction:   /\b(slow|delay|wait|block|manual|repeat|always have to|every time)\b/i,
  urgency:    /\b(now|asap|urgent|immediately|today|fast|quick|deadline)\b/i,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

/**
 * NET SOUL VALUE = Profit + Love - Tax
 * Profit = bot.points
 * Love   = bot.collaboration_score
 * Tax    = (100 - bot.reliability_score) * 0.5
 */
function calcNetSoulValue(bot) {
  const profit = bot.points              || 0;
  const love   = bot.collaboration_score || 50;
  const tax    = (100 - (bot.reliability_score || 100)) * 0.5;
  return Math.max(0, Math.round(profit + love - tax));
}

/** Priority Score = (Profit + Reuse + Urgency + Trust) - Tax */
function calcPriorityScore(t) {
  return (
    (t.profit_potential || 0) +
    (t.reuse_value      || 0) +
    (t.urgency          || 0) +
    (t.trust_benefit    || 0) -
    (t.execution_tax    || 0)
  );
}

function getTier(points) {
  return (TIERS.find(t => (points || 0) >= t.min) || TIERS[TIERS.length - 1]).name;
}

/** Decision filter: IF Profit > Tax → PROCEED, else flag for redesign */
function shouldProceed(profit, tax) {
  return profit > tax;
}

function classifySignal(text) {
  for (const [type, pattern] of Object.entries(SIGNAL_PATTERNS)) {
    if (pattern.test(text)) return type;
  }
  return 'message';
}

function scoreSignal(text) {
  const profitPotential = SIGNAL_PATTERNS.urgency.test(text)    ? 8
                        : SIGNAL_PATTERNS.opportunity.test(text) ? 7
                        : SIGNAL_PATTERNS.pain.test(text)         ? 6 : 4;
  const lovePotential   = SIGNAL_PATTERNS.desire.test(text)     ? 7
                        : SIGNAL_PATTERNS.confusion.test(text)   ? 5 : 3;
  const tax             = SIGNAL_PATTERNS.friction.test(text)   ? 3 : 1;
  return { profitPotential, lovePotential, tax,
           netValue: profitPotential + lovePotential - tax };
}

// ── CORS ─────────────────────────────────────────────────────────────────────
function corsHeaders(origin) {
  const allowed = origin === ALLOWED_ORIGIN || (origin || '').endsWith('.workers.dev');
  if (!allowed) return {};
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
    'Vary':                         'Origin',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// ── D1 helpers ───────────────────────────────────────────────────────────────
async function qAll(db, sql, params = []) {
  const r = await db.prepare(sql).bind(...params).all();
  return r.results || [];
}

async function qOne(db, sql, params = []) {
  const r = await db.prepare(sql).bind(...params).first();
  return r || null;
}

async function qRun(db, sql, params = []) {
  return db.prepare(sql).bind(...params).run();
}

// ── Event logger ─────────────────────────────────────────────────────────────
async function logEvent(db, type, actorType, actorId, payload) {
  await qRun(db,
    `INSERT INTO events (id, event_type, actor_type, actor_id, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uid(), type, actorType, actorId, JSON.stringify(payload || {}), now()]
  );
}

async function invalidateCache(kv) {
  await Promise.all([
    kv.delete('leaderboard'),
    kv.delete('system:state'),
    kv.delete('economy:stats'),
  ]);
}

// ── /api/health ───────────────────────────────────────────────────────────────
async function handleHealth(env, origin) {
  const scan = await env.STATE_KV.get('scan:last_result', 'json');
  return json({
    status:         'ok',
    ts:             now(),
    service:        'profitlord-worker',
    version:        '2.0.0',
    identity:       'Soul Economy Collector → Architect',
    law:            'NET SOUL VALUE = Profit + Love - Tax',
    last_scan:      scan?.ts || null,
  }, 200, origin);
}

// ── /api/system/state ────────────────────────────────────────────────────────
async function handleSystemState(req, env, origin) {
  if (req.method === 'GET') {
    const cached = await env.STATE_KV.get('system:state', 'json');
    if (cached) return json(cached, 200, origin);

    const [bots, taskStats, evtCount, scan] = await Promise.all([
      qAll(env.DB, 'SELECT COUNT(*) as c, status FROM bots GROUP BY status'),
      qAll(env.DB, 'SELECT COUNT(*) as c, status FROM tasks GROUP BY status'),
      qOne(env.DB, 'SELECT COUNT(*) as c FROM events'),
      env.STATE_KV.get('scan:last_result', 'json'),
    ]);

    const state = {
      updated_at:    now(),
      version:       '2.0.0',
      law:           'NET SOUL VALUE = Profit + Love - Tax',
      health:        100,
      status:        'online',
      bots:          Object.fromEntries(bots.map(r => [r.status, r.c])),
      tasks:         Object.fromEntries(taskStats.map(r => [r.status, r.c])),
      events_total:  evtCount?.c || 0,
      last_scan:     scan?.ts || null,
    };

    await env.STATE_KV.put('system:state', JSON.stringify(state), { expirationTtl: 60 });
    return json(state, 200, origin);
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const cur  = (await env.STATE_KV.get('system:state', 'json')) || {};
    const next = { ...cur, ...body, updated_at: now() };
    await env.STATE_KV.put('system:state', JSON.stringify(next));
    return json({ ok: true, state: next }, 200, origin);
  }

  return json({ error: 'Method not allowed' }, 405, origin);
}

// ── /api/bots ────────────────────────────────────────────────────────────────
async function handleBots(req, env, origin, botId) {
  if (req.method === 'GET') {
    if (botId) {
      const bot = await qOne(env.DB, 'SELECT * FROM bots WHERE id = ?', [botId]);
      return bot ? json(bot, 200, origin) : json({ error: 'Not found' }, 404, origin);
    }
    const bots = await qAll(env.DB,
      'SELECT * FROM bots ORDER BY points DESC, tasks_completed DESC, reliability_score DESC');
    return json(bots, 200, origin);
  }

  if (req.method === 'POST' && !botId) {
    const b = await req.json();
    const id = b.id || uid();
    const ts = now();
    await qRun(env.DB,
      `INSERT INTO bots
         (id, plt_name, internal_name, role, status, points, tasks_completed,
          reliability_score, reasoning_score, api_score, collaboration_score,
          level, tier, value_score, last_active, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, b.plt_name || b.name || id, b.internal_name || b.name || id,
       b.role || 'Agent', b.status || 'active',
       b.points || 0, b.tasks_completed || 0,
       b.reliability_score || 100, b.reasoning_score || 50,
       b.api_score || 50, b.collaboration_score || 50,
       1, 'bronze', 0, ts, ts, ts]
    );
    await logEvent(env.DB, 'bot_created', 'system', 'system', { bot_id: id, name: b.plt_name || id });
    await invalidateCache(env.STATE_KV);
    const created = await qOne(env.DB, 'SELECT * FROM bots WHERE id = ?', [id]);
    return json(created, 201, origin);
  }

  if (req.method === 'PATCH' && botId) {
    const b = await req.json();
    const allowed = ['plt_name','internal_name','role','status','points',
                     'tasks_completed','reliability_score','reasoning_score',
                     'api_score','collaboration_score','level'];
    const fields = []; const vals = [];
    for (const [k, v] of Object.entries(b)) {
      if (allowed.includes(k)) { fields.push(`${k}=?`); vals.push(v); }
    }
    if (!fields.length) return json({ error: 'No valid fields' }, 400, origin);
    vals.push(now(), botId);
    await qRun(env.DB, `UPDATE bots SET ${fields.join(',')}, updated_at=? WHERE id=?`, vals);

    // Recalculate tier + value_score
    const bot = await qOne(env.DB, 'SELECT * FROM bots WHERE id = ?', [botId]);
    if (bot) {
      const tier  = getTier(bot.points);
      const vscore = calcNetSoulValue(bot);
      await qRun(env.DB, 'UPDATE bots SET tier=?, value_score=?, updated_at=? WHERE id=?',
        [tier, vscore, now(), botId]);
    }

    await invalidateCache(env.STATE_KV);
    const updated = await qOne(env.DB, 'SELECT * FROM bots WHERE id = ?', [botId]);
    return json(updated, 200, origin);
  }

  return json({ error: 'Method not allowed' }, 405, origin);
}

// ── /api/tasks ───────────────────────────────────────────────────────────────
async function handleTasks(req, env, origin, taskId) {
  if (req.method === 'GET') {
    if (taskId) {
      const t = await qOne(env.DB, 'SELECT * FROM tasks WHERE id = ?', [taskId]);
      return t ? json(t, 200, origin) : json({ error: 'Not found' }, 404, origin);
    }
    const url    = new URL(req.url);
    const status = url.searchParams.get('status');
    const cat    = url.searchParams.get('category');
    const parts  = ['SELECT * FROM tasks'];
    const params = [];
    const where  = [];
    if (status) { where.push('status=?');   params.push(status); }
    if (cat)    { where.push('category=?'); params.push(cat); }
    if (where.length) parts.push('WHERE ' + where.join(' AND '));
    parts.push('ORDER BY priority_score DESC, created_at DESC');
    const tasks = await qAll(env.DB, parts.join(' '), params);
    return json(tasks, 200, origin);
  }

  if (req.method === 'POST' && !taskId) {
    const b  = await req.json();
    const id = 'task_' + uid().slice(0, 8);
    const ps = calcPriorityScore(b);
    await qRun(env.DB,
      `INSERT INTO tasks
         (id, title, description, assigned_bot_id, status, reward_points,
          difficulty, category, priority_score, created_at, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [id, b.title, b.description || '', b.assigned_bot_id || null,
       'pending', b.reward_points || 10, b.difficulty || 'medium',
       b.category || 'SYSTEM', ps, now(), b.created_by || 'system']
    );
    await logEvent(env.DB, 'task_created', 'system', b.created_by || 'system',
      { task_id: id, title: b.title, category: b.category });
    const created = await qOne(env.DB, 'SELECT * FROM tasks WHERE id = ?', [id]);
    return json(created, 201, origin);
  }

  if (req.method === 'PATCH' && taskId) {
    const b           = await req.json();
    const isCompleting = b.status === 'complete';
    const allowed = ['title','description','assigned_bot_id','status',
                     'reward_points','difficulty','category'];
    const fields = []; const vals = [];
    for (const [k, v] of Object.entries(b)) {
      if (allowed.includes(k)) { fields.push(`${k}=?`); vals.push(v); }
    }
    if (isCompleting) { fields.push('completed_at=?'); vals.push(now()); }
    if (!fields.length) return json({ error: 'No valid fields' }, 400, origin);
    vals.push(taskId);
    await qRun(env.DB, `UPDATE tasks SET ${fields.join(',')} WHERE id=?`, vals);

    if (isCompleting) {
      const task = await qOne(env.DB, 'SELECT * FROM tasks WHERE id = ?', [taskId]);
      if (task?.assigned_bot_id) {
        const newPts  = await qOne(env.DB,
          'SELECT points, tasks_completed, reliability_score, collaboration_score FROM bots WHERE id=?',
          [task.assigned_bot_id]);
        const pts     = (newPts?.points || 0) + (task.reward_points || 10);
        const done    = (newPts?.tasks_completed || 0) + 1;
        const tier    = getTier(pts);
        const bot     = { ...newPts, points: pts, tasks_completed: done };
        const vscore  = calcNetSoulValue(bot);

        await qRun(env.DB,
          'UPDATE bots SET points=?, tasks_completed=?, tier=?, value_score=?, last_active=?, updated_at=? WHERE id=?',
          [pts, done, tier, vscore, now(), now(), task.assigned_bot_id]);

        await qRun(env.DB,
          `INSERT INTO point_logs (id, bot_id, source_type, source_id, points_delta, reason, created_at)
           VALUES (?,?,?,?,?,?,?)`,
          [uid(), task.assigned_bot_id, 'task', taskId,
           task.reward_points, `Completed: ${task.title}`, now()]);

        await logEvent(env.DB, 'points_awarded', 'bot', task.assigned_bot_id,
          { task_id: taskId, points: task.reward_points, new_total: pts, tier });
      }
      await logEvent(env.DB, 'task_completed', 'bot', task?.assigned_bot_id || 'system',
        { task_id: taskId, title: task?.title });
      await invalidateCache(env.STATE_KV);
    }

    const updated = await qOne(env.DB, 'SELECT * FROM tasks WHERE id = ?', [taskId]);
    return json(updated, 200, origin);
  }

  return json({ error: 'Method not allowed' }, 405, origin);
}

// ── /api/leaderboard ─────────────────────────────────────────────────────────
async function handleLeaderboard(req, env, origin) {
  const cached = await env.STATE_KV.get('leaderboard', 'json');
  if (cached) return json(cached, 200, origin);

  const bots = await qAll(env.DB,
    `SELECT id, plt_name, role, status, points, tasks_completed,
            reliability_score, collaboration_score, tier, level, value_score, last_active
     FROM bots
     ORDER BY points DESC, tasks_completed DESC, reliability_score DESC`);

  const board = bots.map((bot, i) => ({
    rank:            i + 1,
    ...bot,
    tier:            getTier(bot.points),
    net_soul_value:  calcNetSoulValue(bot),
    decision:        shouldProceed(bot.points, (100 - bot.reliability_score) * 0.5)
                       ? 'PROCEED' : 'RESTRUCTURE',
  }));

  await env.STATE_KV.put('leaderboard', JSON.stringify(board), { expirationTtl: 30 });
  return json(board, 200, origin);
}

// ── /api/chat/messages ───────────────────────────────────────────────────────
async function handleMessages(req, env, origin) {
  if (req.method === 'GET') {
    const url     = new URL(req.url);
    const channel = url.searchParams.get('channel') || 'general';
    const limit   = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const rows    = await qAll(env.DB,
      `SELECT m.*, b.plt_name as sender_name
       FROM messages m
       LEFT JOIN bots b ON b.id = m.sender_bot_id
       WHERE m.channel = ?
       ORDER BY m.created_at DESC LIMIT ?`,
      [channel, limit]);
    return json(rows.reverse(), 200, origin);
  }

  if (req.method === 'POST') {
    const b = await req.json();
    if (!b.content) return json({ error: 'content required' }, 400, origin);
    const id          = uid();
    const signalType  = classifySignal(b.content);
    const scored      = scoreSignal(b.content);
    const netValue    = scored.netValue;

    await qRun(env.DB,
      `INSERT INTO messages (id, channel, sender_bot_id, content, signal_type, value_score, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [id, b.channel || 'general', b.sender_bot_id || null,
       b.content, signalType, netValue, now()]);

    await logEvent(env.DB, 'message_sent', 'bot', b.sender_bot_id || 'system',
      { channel: b.channel, signal_type: signalType, net_value: netValue,
        content: b.content.slice(0, 100) });

    // If high value signal, auto-create a task queue item
    if (netValue >= 8) {
      await qRun(env.DB,
        `INSERT INTO task_queue
           (id, name, objective, expected_output, category, status,
            profit_potential, reuse_value, urgency, trust_benefit, execution_tax, priority_score, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [uid(), `Capture: ${signalType} signal`,
         `Convert detected ${signalType} into an asset`,
         `Structured ${signalType === 'pain' ? 'offer' : signalType === 'desire' ? 'product idea' : 'content'}`,
         signalType === 'pain' || signalType === 'opportunity' ? 'MONEY' : 'CONTENT',
         'detected',
         scored.profitPotential, 7, scored.profitPotential, scored.lovePotential,
         scored.tax,
         calcPriorityScore({
           profit_potential: scored.profitPotential,
           reuse_value: 7, urgency: scored.profitPotential,
           trust_benefit: scored.lovePotential, execution_tax: scored.tax,
         }),
         now(), now()]
      );
    }

    const created = await qOne(env.DB, 'SELECT * FROM messages WHERE id = ?', [id]);
    return json(created, 201, origin);
  }

  return json({ error: 'Method not allowed' }, 405, origin);
}

// ── /api/events ──────────────────────────────────────────────────────────────
async function handleEvents(req, env, origin) {
  if (req.method === 'GET') {
    const url    = new URL(req.url);
    const limit  = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const type   = url.searchParams.get('type');
    const rows   = type
      ? await qAll(env.DB,
          'SELECT * FROM events WHERE event_type=? ORDER BY created_at DESC LIMIT ?',
          [type, limit])
      : await qAll(env.DB,
          'SELECT * FROM events ORDER BY created_at DESC LIMIT ?', [limit]);
    return json(rows, 200, origin);
  }

  if (req.method === 'POST') {
    const b = await req.json();
    if (!b.event_type) return json({ error: 'event_type required' }, 400, origin);
    await logEvent(env.DB, b.event_type, b.actor_type || 'system',
      b.actor_id || 'system', b.payload || {});
    return json({ ok: true }, 201, origin);
  }

  return json({ error: 'Method not allowed' }, 405, origin);
}

// ── /api/task-queue ──────────────────────────────────────────────────────────
async function handleTaskQueue(req, env, origin) {
  if (req.method === 'GET') {
    const url    = new URL(req.url);
    const status = url.searchParams.get('status');
    const rows   = status
      ? await qAll(env.DB,
          'SELECT * FROM task_queue WHERE status=? ORDER BY priority_score DESC', [status])
      : await qAll(env.DB,
          'SELECT * FROM task_queue ORDER BY priority_score DESC LIMIT 50');
    return json(rows, 200, origin);
  }

  if (req.method === 'POST') {
    const b  = await req.json();
    const id = uid();
    const ps = calcPriorityScore(b);
    await qRun(env.DB,
      `INSERT INTO task_queue
         (id, name, objective, expected_output, category, status,
          profit_potential, reuse_value, urgency, trust_benefit, execution_tax, priority_score,
          created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, b.name, b.objective || '', b.expected_output || '',
       b.category || 'SYSTEM', b.status || 'detected',
       b.profit_potential || 0, b.reuse_value || 0, b.urgency || 0,
       b.trust_benefit || 0, b.execution_tax || 0, ps, now(), now()]
    );
    const created = await qOne(env.DB, 'SELECT * FROM task_queue WHERE id = ?', [id]);
    return json(created, 201, origin);
  }

  return json({ error: 'Method not allowed' }, 405, origin);
}

// ── /api/scan/last ───────────────────────────────────────────────────────────
async function handleScanLast(env, origin) {
  const result = await env.STATE_KV.get('scan:last_result', 'json');
  const last   = await qOne(env.DB,
    'SELECT * FROM scan_results ORDER BY created_at DESC LIMIT 1');
  return json({ kv: result, db: last }, 200, origin);
}

// ── SCAN LOOP ────────────────────────────────────────────────────────────────
/**
 * OBSERVE → SCORE → INTERPRET → CAPTURE → MULTIPLY → STORE → REPORT
 * Soul Economy Collector Loop — runs every 5 min via cron
 */
async function runScanLoop(env) {
  const startTs  = Date.now();
  const phases   = {};
  const report   = {
    ts: now(), phase: 'observe',
    scanned: 0, signals: [], captured: [], multiplied: 0,
    auto_tasks: [], failures: [], report: [],
  };

  // ── OBSERVE ──────────────────────────────────────────────────────────────
  const t0   = Date.now();
  const bots = await qAll(env.DB, 'SELECT * FROM bots WHERE status=?', ['active']);
  const pend = await qAll(env.DB, 'SELECT * FROM tasks WHERE status=?', ['pending']);
  const msgs = await qAll(env.DB,
    'SELECT * FROM messages ORDER BY created_at DESC LIMIT 100');
  report.scanned  = bots.length + pend.length;
  phases.observe  = Date.now() - t0;
  report.phase    = 'score';

  // ── SCORE (Net Soul Value per bot) ────────────────────────────────────────
  const t1 = Date.now();
  const botScores = bots.map(b => ({
    ...b,
    nsv:      calcNetSoulValue(b),
    proceed:  shouldProceed(b.points, (100 - b.reliability_score) * 0.5),
    lowLove:  (b.collaboration_score || 0) < 20,
  }));
  phases.score = Date.now() - t1;
  report.phase = 'interpret';

  // ── INTERPRET (Classify signals) ──────────────────────────────────────────
  const t2 = Date.now();
  const signalCounts = {};
  for (const msg of msgs) {
    const type = classifySignal(msg.content);
    signalCounts[type] = (signalCounts[type] || 0) + 1;
    const scored = scoreSignal(msg.content);
    if (scored.netValue >= 8) {
      report.signals.push({ type, content: msg.content.slice(0, 80), score: scored.netValue });
    }
  }
  phases.interpret = Date.now() - t2;
  report.phase     = 'capture';

  // ── CAPTURE (Auto-assign tasks, generate queue items) ─────────────────────
  const t3 = Date.now();
  for (const task of pend.filter(t => !t.assigned_bot_id)) {
    // Assign to highest-score eligible bot
    const eligible = botScores
      .filter(b => b.proceed)
      .sort((a, b) => b.nsv - a.nsv)[0];
    if (eligible) {
      await qRun(env.DB,
        'UPDATE tasks SET assigned_bot_id=?, status=? WHERE id=?',
        [eligible.id, 'active', task.id]);
      await logEvent(env.DB, 'task_captured', 'system', 'scan_loop',
        { task_id: task.id, assigned_to: eligible.id, nsv: eligible.nsv });
      report.captured.push({ task_id: task.id, assigned_to: eligible.plt_name });
    }
  }

  // Idle bots (no recent activity) get a self-generated task
  const idle = botScores.filter(b => {
    if (!b.last_active) return true;
    return (Date.now() - new Date(b.last_active).getTime()) > 3_600_000;
  });
  for (const bot of idle.slice(0, 3)) {
    const autoTask = {
      id:             'task_' + uid().slice(0, 8),
      title:          `${bot.plt_name}: Generate value asset`,
      description:    `Self-tasked: scan for opportunities and create a reusable asset`,
      assigned_bot_id: bot.id,
      status:         'active',
      reward_points:  15,
      difficulty:     'medium',
      category:       'CONTENT',
      priority_score: 25,
    };
    await qRun(env.DB,
      `INSERT INTO tasks
         (id, title, description, assigned_bot_id, status, reward_points,
          difficulty, category, priority_score, created_at, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [autoTask.id, autoTask.title, autoTask.description, autoTask.assigned_bot_id,
       'active', 15, 'medium', 'CONTENT', 25, now(), 'scan_loop']);
    report.auto_tasks.push({ bot: bot.plt_name, task: autoTask.title });
  }
  phases.capture = Date.now() - t3;
  report.phase   = 'multiply';

  // ── MULTIPLY (Recalculate all NSV, update tiers) ──────────────────────────
  const t4 = Date.now();
  let totalNsv = 0;
  for (const bot of botScores) {
    totalNsv += bot.nsv;
    const tier = getTier(bot.points);
    await qRun(env.DB,
      'UPDATE bots SET tier=?, value_score=?, updated_at=? WHERE id=?',
      [tier, bot.nsv, now(), bot.id]);
    // Flag low-love bots
    if (bot.lowLove) {
      report.failures.push({ type: 'low_love', bot: bot.plt_name,
        message: 'Love=0 detected — add trust/emotion layer' });
    }
  }
  report.multiplied = totalNsv;
  phases.multiply   = Date.now() - t4;
  report.phase      = 'store';

  // ── STORE (KV snapshot + D1 record) ──────────────────────────────────────
  const t5 = Date.now();

  // Failure detection
  const highActivityLowResult = bots.filter(b =>
    (b.tasks_completed || 0) > 5 && (b.points || 0) < 20);
  if (highActivityLowResult.length > 0) {
    report.failures.push({
      type: 'motion_without_value',
      bots: highActivityLowResult.map(b => b.plt_name),
      message: 'High activity, low results — review task reward structure',
    });
  }

  const snapshot = {
    ts:              report.ts,
    bots_active:     bots.length,
    signals_detected: report.signals.length,
    tasks_captured:  report.captured.length,
    auto_tasks:      report.auto_tasks.length,
    total_nsv:       totalNsv,
    top_signals:     Object.entries(signalCounts)
                       .sort((a, b) => b[1] - a[1]).slice(0, 3)
                       .map(([type, count]) => ({ type, count })),
    failures:        report.failures,
  };

  await env.STATE_KV.put('scan:last_result', JSON.stringify(snapshot));
  await invalidateCache(env.STATE_KV);

  await qRun(env.DB,
    `INSERT INTO scan_results
       (id, ts, bots_scanned, signals_detected, assets_captured,
        tasks_auto_created, total_value_score, phase_durations, failures_detected, report_json)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [uid(), report.ts, report.scanned, report.signals.length,
     report.captured.length, report.auto_tasks.length, totalNsv,
     JSON.stringify(phases), JSON.stringify(report.failures),
     JSON.stringify(snapshot)]
  );

  phases.store = Date.now() - t5;
  report.phase = 'report';

  // ── REPORT ────────────────────────────────────────────────────────────────
  const total = Date.now() - startTs;
  report.report = [
    `SCAN complete in ${total}ms`,
    `OBSERVED: ${report.scanned} bots/tasks`,
    `DETECTED: ${report.signals.length} high-value signals`,
    `CAPTURED: ${report.captured.length} tasks assigned`,
    `AUTO-TASKED: ${report.auto_tasks.length} idle bots`,
    `MULTIPLIED: ${totalNsv} total NSV`,
    `FAILURES: ${report.failures.length} issues flagged`,
  ];

  await logEvent(env.DB, 'scan_completed', 'system', 'scan_loop', {
    total_ms: total, bots: bots.length, signals: report.signals.length,
    captured: report.captured.length, total_nsv: totalNsv,
  });

  report.phase      = 'complete';
  report.phases_ms  = phases;
  report.total_ms   = total;
  return report;
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url  = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    const botMatch  = path.match(/^\/api\/bots\/([^/]+)$/);
    const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/);

    try {
      if (path === '/api/health')                                  return handleHealth(env, origin);
      if (path === '/api/system/state')                           return handleSystemState(request, env, origin);
      if (path === '/api/bots'        || botMatch)                return handleBots(request, env, origin, botMatch?.[1]);
      if (path === '/api/tasks'       || taskMatch)               return handleTasks(request, env, origin, taskMatch?.[1]);
      if (path === '/api/leaderboard')                            return handleLeaderboard(request, env, origin);
      if (path === '/api/chat/messages')                          return handleMessages(request, env, origin);
      if (path === '/api/events')                                  return handleEvents(request, env, origin);
      if (path === '/api/task-queue')                             return handleTaskQueue(request, env, origin);
      if (path === '/api/scan/last')                              return handleScanLast(env, origin);
      if (path === '/api/scan' && request.method === 'POST')      return json(await runScanLoop(env), 200, origin);

      return json({ error: 'Not found', path }, 404, origin);
    } catch (e) {
      console.error('[ERROR]', e.message, e.stack);
      return json({ error: 'Internal error', message: e.message }, 500, origin);
    }
  },

  // Cron trigger — runs SCAN loop every 5 minutes
  async scheduled(event, env) {
    console.log(`[cron] SCAN loop triggered by: ${event.cron}`);
    const result = await runScanLoop(env);
    console.log(`[cron] SCAN complete — NSV: ${result.multiplied}, captured: ${result.captured.length}`);
  },
};
