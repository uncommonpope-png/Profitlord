/**
 * Profitlord Soul Economy — OS Engine v2.0
 * =========================================
 * IDENTITY : Soul Economy Collector → Architect
 * LAW      : NET SOUL VALUE = Profit + Love - Tax
 * LOOP     : OBSERVE → SCORE → INTERPRET → CAPTURE → MULTIPLY → STORE → REPORT
 *
 * Exposed as: window.ProfitlordOS
 */
'use strict';

const ProfitlordOS = (() => {
  // ── Constants ───────────────────────────────────────────────────────────────
  const V          = '2.0.0';
  const STATE_KEY  = 'plt_os_state_v2';
  const LEDGER_KEY = 'plt_os_ledger_v2';
  const QUEUE_KEY  = 'plt_os_queue_v2';
  const POLL_MS    = 30_000;   // sync remote every 30 s
  const SCAN_MS    = 60_000;   // run SCAN loop every 60 s
  const LEDGER_MAX = 500;

  const TIERS = [
    { min: 1000, name: 'mythic',  color: '#ffd700' },
    { min: 500,  name: 'elite',   color: '#c084fc' },
    { min: 200,  name: 'gold',    color: '#f59e0b' },
    { min: 100,  name: 'silver',  color: '#9ca3af' },
    { min: 0,    name: 'bronze',  color: '#cd7f32' },
  ];

  const SIGNAL_PATTERNS = {
    pain:        /\b(broken|fail|issue|error|stuck|can't|doesn't work|problem|help|fix)\b/i,
    desire:      /\b(want|need|wish|love|goal|dream|build|grow|scale|more)\b/i,
    confusion:   /\b(how|why|what does|confused|unclear|not sure|explain|means)\b/i,
    opportunity: /\b(opportunity|potential|idea|launch|announce|new|first|early)\b/i,
    friction:    /\b(slow|delay|wait|block|manual|repeat|always have to|every time)\b/i,
    urgency:     /\b(now|asap|urgent|immediately|today|fast|quick|deadline)\b/i,
  };

  const DEFAULT_BOTS = [
    { id: 'soulcollector', name: 'SoulCollector', role: 'Soul Orchestrator',       collaboration_score: 90, reliability_score: 100 },
    { id: 'profit',        name: 'Profit',        role: 'Chief Profit Officer',     collaboration_score: 80, reliability_score: 100 },
    { id: 'deerg',         name: 'Deerg',         role: 'Deal Evaluator',           collaboration_score: 75, reliability_score: 95  },
    { id: 'betty',         name: 'Betty',         role: 'Business Operations',      collaboration_score: 85, reliability_score: 98  },
    { id: 'teacher',       name: 'Teacher',       role: 'Knowledge Synthesizer',    collaboration_score: 92, reliability_score: 96  },
    { id: 'architect',     name: 'Architect',     role: 'Systems Designer',         collaboration_score: 78, reliability_score: 97  },
    { id: 'builder',       name: 'Builder',       role: 'Execution Engine',         collaboration_score: 70, reliability_score: 99  },
    { id: 'auditor',       name: 'Auditor',       role: 'Quality & Compliance',     collaboration_score: 82, reliability_score: 100 },
    { id: 'scout',         name: 'Scout',         role: 'Intelligence Gatherer',    collaboration_score: 76, reliability_score: 94  },
    { id: 'scribe',        name: 'Scribe',        role: 'Documentation Specialist', collaboration_score: 88, reliability_score: 96  },
  ];

  // ── Internal state ──────────────────────────────────────────────────────────
  let _state    = null;
  let _ledger   = [];
  let _queue    = [];   // internal task queue
  let _subs     = [];
  let _pollId   = null;
  let _scanId   = null;
  let _scanPhase = null;  // current SCAN phase for UI

  // ── Utils ───────────────────────────────────────────────────────────────────
  function uid() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  function now() { return new Date().toISOString(); }

  function mergeDeep(target, source) {
    const out = Object.assign({}, target);
    for (const [k, v] of Object.entries(source)) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)
          && out[k] !== null && typeof out[k] === 'object' && !Array.isArray(out[k])) {
        out[k] = mergeDeep(out[k], v);
      } else { out[k] = v; }
    }
    return out;
  }

  function defaultState() {
    return {
      system:      { health: 100, status: 'online', version: V, updated_at: now(),
                     identity: 'Soul Economy Collector → Architect',
                     law: 'NET SOUL VALUE = Profit + Love - Tax' },
      bots:        {},
      tasks:       {},
      leaderboard: [],
      chat:        { channels: { general: [], ops: [], profit: [], intel: [] } },
      economy:     { total_nsv: 0, total_points: 0, total_tasks: 0, active_bots: 0 },
      missions:    {},
      scan:        { last_run: null, phase: 'idle', last_report: [] },
      money_mode:  false,
      architect_mode: false,
    };
  }

  // ── Persistence ─────────────────────────────────────────────────────────────
  function _save()       { try { localStorage.setItem(STATE_KEY,  JSON.stringify(_state));               } catch (_) {} }
  function _saveLedger() { try { localStorage.setItem(LEDGER_KEY, JSON.stringify(_ledger.slice(-LEDGER_MAX))); } catch (_) {} }
  function _saveQueue()  { try { localStorage.setItem(QUEUE_KEY,  JSON.stringify(_queue));               } catch (_) {} }
  function _load()       { try { const r = localStorage.getItem(STATE_KEY);  return r ? JSON.parse(r) : null; } catch (_) { return null; } }
  function _loadLedger() { try { const r = localStorage.getItem(LEDGER_KEY); return r ? JSON.parse(r) : []; }  catch (_) { return []; } }
  function _loadQueue()  { try { const r = localStorage.getItem(QUEUE_KEY);  return r ? JSON.parse(r) : []; }  catch (_) { return []; } }

  // ── State engine ─────────────────────────────────────────────────────────────
  function setState(patch) {
    _state = mergeDeep(_state, patch);
    _state.system.updated_at = now();
    _save();
    _notify();
  }
  function getState()       { return _state; }
  function subscribe(fn)    { _subs.push(fn); return () => { _subs = _subs.filter(s => s !== fn); }; }
  function _notify()        { _subs.forEach(fn => { try { fn(_state); } catch (_) {} }); }

  // ── NET SOUL VALUE ───────────────────────────────────────────────────────────
  /**
   * NET SOUL VALUE = Profit + Love - Tax
   * Profit = bot.points
   * Love   = bot.collaboration_score
   * Tax    = (100 - bot.reliability_score) * 0.5
   * Decision: IF Profit > Tax → PROCEED, else RESTRUCTURE
   */
  function calcNSV(bot) {
    const profit = bot.points              || 0;
    const love   = bot.collaboration_score || 50;
    const tax    = (100 - (bot.reliability_score || 100)) * 0.5;
    return { profit, love, tax, nsv: Math.max(0, Math.round(profit + love - tax)),
             proceed: profit > tax, lowLove: love < 20 };
  }

  /** Priority Score = (Profit + Reuse + Urgency + Trust) - Tax */
  function calcPriorityScore(t) {
    return (t.profit_potential || 0) + (t.reuse_value || 0)
         + (t.urgency || 0) + (t.trust_benefit || 0) - (t.execution_tax || 0);
  }

  function getTier(points) {
    return TIERS.find(t => (points || 0) >= t.min) || TIERS[TIERS.length - 1];
  }

  // ── Ledger engine ────────────────────────────────────────────────────────────
  function appendLedger(type, actor, payload) {
    const ev = { id: uid(), ts: now(), type, actor, payload: payload || {} };
    _ledger.push(ev);
    _saveLedger();
    return ev;
  }
  function getLedger(opts) {
    let ev = [..._ledger];
    if (opts?.type)  ev = ev.filter(e => e.type  === opts.type);
    if (opts?.actor) ev = ev.filter(e => e.actor === opts.actor);
    if (opts?.limit) ev = ev.slice(-opts.limit);
    return ev;
  }

  // ── Bot system ───────────────────────────────────────────────────────────────
  function addBot(id, name, role, extraFields) {
    const bot = {
      id, name, role,
      status:             'active',
      points:             0,
      tasks_completed:    0,
      reliability_score:  100,
      reasoning_score:    50,
      api_score:          50,
      collaboration_score: 50,
      level:              1,
      tier:               'bronze',
      value_score:        0,
      last_active:        now(),
      created_at:         now(),
      ...(extraFields || {}),
    };
    bot.value_score = calcNSV(bot).nsv;
    setState({ bots: { [id]: bot } });
    appendLedger('bot_created', 'system', { bot_id: id, name, role });
    updateLeaderboard();
    return bot;
  }

  function updateBotStats(botId, patch) {
    if (!_state.bots[botId]) return null;
    setState({ bots: { [botId]: { ...patch, last_active: now() } } });
    const bot  = _state.bots[botId];
    const tier = getTier(bot.points).name;
    const nsv  = calcNSV(bot).nsv;
    setState({ bots: { [botId]: { tier, value_score: nsv } } });
    updateLeaderboard();
    return _state.bots[botId];
  }

  function getBots()   { return Object.values(_state.bots || {}); }
  function getBot(id)  { return _state.bots[id] || null; }

  // ── Task system ──────────────────────────────────────────────────────────────
  function createTask(title, description, assignedBotId, rewardPoints, category) {
    const id = 'task_' + Date.now().toString(36);
    const task = {
      id, title, description: description || '',
      assigned_bot: assignedBotId || null,
      status:       'pending',
      reward_points: rewardPoints || 10,
      category:     category || 'SYSTEM',
      created_at:   now(),
      completed_at: null,
    };
    setState({ tasks: { [id]: task } });
    appendLedger('task_created', 'system', { task_id: id, title, assigned_bot: assignedBotId });
    return task;
  }

  function completeTask(taskId) {
    const task = _state.tasks[taskId];
    if (!task || task.status === 'complete') return null;
    const doneAt = now();
    setState({ tasks: { [taskId]: { status: 'complete', completed_at: doneAt } } });

    if (task.assigned_bot && _state.bots[task.assigned_bot]) {
      const bot    = _state.bots[task.assigned_bot];
      const pts    = (bot.points || 0) + (task.reward_points || 10);
      const done   = (bot.tasks_completed || 0) + 1;
      const tier   = getTier(pts).name;
      const nsv    = calcNSV({ ...bot, points: pts }).nsv;
      setState({ bots: { [task.assigned_bot]: {
        points: pts, tasks_completed: done, tier, value_score: nsv, last_active: doneAt } } });
      appendLedger('points_awarded', task.assigned_bot,
        { task_id: taskId, points: task.reward_points, total_points: pts });
    }
    appendLedger('task_completed', task.assigned_bot || 'system',
      { task_id: taskId, title: task.title, reward_points: task.reward_points });
    updateLeaderboard();
    return _state.tasks[taskId];
  }

  function getTasks(filter) {
    const all = Object.values(_state.tasks || {});
    if (!filter) return all;
    return all.filter(t => (!filter.status || t.status === filter.status)
                        && (!filter.category || t.category === filter.category));
  }

  // ── Leaderboard engine ───────────────────────────────────────────────────────
  function updateLeaderboard() {
    const board = getBots()
      .sort((a, b) => {
        const nsvA = calcNSV(a).nsv, nsvB = calcNSV(b).nsv;
        if (nsvB !== nsvA) return nsvB - nsvA;
        if (b.points !== a.points) return (b.points || 0) - (a.points || 0);
        return (b.tasks_completed || 0) - (a.tasks_completed || 0);
      })
      .map((bot, i) => {
        const { profit, love, tax, nsv, proceed, lowLove } = calcNSV(bot);
        const tier = getTier(bot.points);
        return {
          rank: i + 1, id: bot.id, name: bot.name, role: bot.role,
          points: bot.points || 0,
          tasks_completed: bot.tasks_completed || 0,
          net_soul_value: nsv,
          profit, love, tax,
          proceed, low_love: lowLove,
          tier: tier.name, tier_color: tier.color,
          status: bot.status,
          last_active: bot.last_active,
        };
      });

    const eco = getEconomyStats();
    setState({ leaderboard: board, economy: eco });
    return board;
  }

  // ── Chat system ──────────────────────────────────────────────────────────────
  function sendMessage(sender, content, channel) {
    channel = channel || 'general';
    const msg = { id: uid(), sender, content, timestamp: now(), channel,
                  signal_type: _classifySignal(content) };
    const prev    = _state.chat?.channels?.[channel] || [];
    const updated = [...prev, msg].slice(-100);
    setState({ chat: { channels: { [channel]: updated } } });
    appendLedger('message_sent', sender, { content: content.slice(0, 200), channel,
                                           signal_type: msg.signal_type });
    return msg;
  }
  function getMessages(channel) { return _state.chat?.channels?.[channel || 'general'] || []; }

  // ── Economy ──────────────────────────────────────────────────────────────────
  function getEconomyStats() {
    const bots = getBots();
    return {
      total_points: bots.reduce((s, b) => s + (b.points             || 0), 0),
      total_tasks:  bots.reduce((s, b) => s + (b.tasks_completed    || 0), 0),
      active_bots:  bots.filter(b => b.status === 'active').length,
      total_nsv:    bots.reduce((s, b) => s + (calcNSV(b).nsv       || 0), 0),
    };
  }

  // ── Signal classification ────────────────────────────────────────────────────
  function _classifySignal(text) {
    for (const [type, rx] of Object.entries(SIGNAL_PATTERNS)) {
      if (rx.test(text)) return type;
    }
    return 'message';
  }

  function _scoreSignal(text) {
    const profit = SIGNAL_PATTERNS.urgency.test(text)    ? 8
                 : SIGNAL_PATTERNS.opportunity.test(text) ? 7
                 : SIGNAL_PATTERNS.pain.test(text)        ? 6 : 4;
    const love   = SIGNAL_PATTERNS.desire.test(text)     ? 7
                 : SIGNAL_PATTERNS.confusion.test(text)   ? 5 : 3;
    const tax    = SIGNAL_PATTERNS.friction.test(text)   ? 3 : 1;
    return { profit, love, tax, nsv: profit + love - tax };
  }

  // ── Self-tasking (GENERATE tasks when idle) ───────────────────────────────
  function generateTasks() {
    const generated = [];
    const bots      = getBots();
    const tasks     = getTasks();

    // 1. MONEY — low-revenue bots
    const lowRevenue = bots.filter(b => (b.points || 0) < 10 && b.status === 'active');
    if (lowRevenue.length > 0) {
      generated.push({
        name: 'Activate low-revenue bots',
        objective: `Assign tasks to ${lowRevenue.length} bots earning < 10 pts`,
        expected_output: 'All flagged bots have active tasks',
        category: 'MONEY',
        profit_potential: 8, reuse_value: 6, urgency: 7, trust_benefit: 5, execution_tax: 2,
      });
    }

    // 2. SYSTEM — unassigned tasks
    const unassigned = tasks.filter(t => t.status === 'pending' && !t.assigned_bot);
    if (unassigned.length > 0) {
      generated.push({
        name: `Auto-assign ${unassigned.length} pending tasks`,
        objective: 'Ensure no task sits unassigned',
        expected_output: 'All pending tasks have a bot assigned',
        category: 'SYSTEM',
        profit_potential: 7, reuse_value: 8, urgency: 9, trust_benefit: 6, execution_tax: 1,
      });
    }

    // 3. CONTENT — no recent messages
    const recentMsgs = getMessages('general').filter(m => {
      const age = Date.now() - new Date(m.timestamp).getTime();
      return age < 3_600_000;
    });
    if (recentMsgs.length === 0) {
      generated.push({
        name: 'Generate system status content',
        objective: 'Create a shareable update on Soul Economy activity',
        expected_output: 'Post-ready content asset stored in general channel',
        category: 'CONTENT',
        profit_potential: 6, reuse_value: 10, urgency: 4, trust_benefit: 9, execution_tax: 2,
      });
    }

    // 4. INTELLIGENCE — no recent scan
    const lastScan = _state.scan?.last_run;
    if (!lastScan || (Date.now() - new Date(lastScan).getTime()) > 3_600_000) {
      generated.push({
        name: 'Run SCAN loop — detect value signals',
        objective: 'Identify top 3 high-NSV opportunities from current state',
        expected_output: 'Scan report with detected signals',
        category: 'INTELLIGENCE',
        profit_potential: 9, reuse_value: 8, urgency: 8, trust_benefit: 8, execution_tax: 2,
      });
    }

    const newItems = generated
      .map(t => ({
        ...t,
        id: 'tq_' + uid().slice(0, 8),
        priority_score: calcPriorityScore(t),
        status: 'queued',
        created_at: now(),
      }))
      .sort((a, b) => b.priority_score - a.priority_score)
      .slice(0, 5);

    _queue.push(...newItems.filter(n => !_queue.find(q => q.name === n.name)));
    _saveQueue();
    return newItems;
  }

  function getTaskQueue(filter) {
    if (!filter) return _queue;
    return _queue.filter(t => !filter.status || t.status === filter.status);
  }

  function updateQueueItem(id, patch) {
    const idx = _queue.findIndex(t => t.id === id);
    if (idx === -1) return null;
    _queue[idx] = { ..._queue[idx], ...patch };
    _saveQueue();
    return _queue[idx];
  }

  // ── SCAN loop (browser) ──────────────────────────────────────────────────────
  /**
   * OBSERVE → SCORE → INTERPRET → CAPTURE → MULTIPLY → STORE → REPORT
   */
  async function runScan() {
    const report = { ts: now(), phases: {}, signals: [], captured: [], failures: [], report: [] };
    const t0     = Date.now();

    // Set phase for UI watchers
    const setPhase = (p) => {
      _scanPhase = p;
      setState({ scan: { phase: p } });
    };

    // OBSERVE
    setPhase('observe');
    const bots  = getBots();
    const tasks = getTasks();
    const msgs  = getMessages('general').slice(-50);
    report.phases.observe = Date.now() - t0;

    // SCORE
    setPhase('score');
    const scored = bots.map(b => ({ ...b, ...calcNSV(b) }));
    report.phases.score = Date.now() - t0;

    // INTERPRET
    setPhase('interpret');
    const signalCounts = {};
    for (const msg of msgs) {
      const type  = _classifySignal(msg.content || '');
      const score = _scoreSignal(msg.content || '');
      signalCounts[type] = (signalCounts[type] || 0) + 1;
      if (score.nsv >= 8) {
        report.signals.push({ type, content: (msg.content || '').slice(0, 80), score: score.nsv });
      }
    }
    report.phases.interpret = Date.now() - t0;

    // CAPTURE
    setPhase('capture');
    const unassigned = tasks.filter(t => t.status === 'pending' && !t.assigned_bot);
    for (const task of unassigned) {
      const eligible = scored.filter(b => b.proceed)
                             .sort((a, b) => b.nsv - a.nsv)[0];
      if (eligible) {
        setState({ tasks: { [task.id]: { assigned_bot: eligible.id, status: 'active' } } });
        report.captured.push({ task_id: task.id, assigned_to: eligible.name });
        appendLedger('task_captured', 'scan_loop',
          { task_id: task.id, assigned_to: eligible.id });
      }
    }
    // Auto-task idle bots
    const idle = scored.filter(b => {
      if (!b.last_active) return true;
      return (Date.now() - new Date(b.last_active).getTime()) > 3_600_000;
    }).slice(0, 3);
    for (const bot of idle) {
      const t = createTask(
        `${bot.name}: Generate value asset`,
        'Self-tasked: scan for opportunities and produce a reusable asset',
        bot.id, 15, 'CONTENT'
      );
      report.captured.push({ task_id: t.id, assigned_to: bot.name, auto: true });
    }
    report.phases.capture = Date.now() - t0;

    // MULTIPLY
    setPhase('multiply');
    let totalNsv = 0;
    for (const bot of scored) {
      totalNsv += bot.nsv;
      setState({ bots: { [bot.id]: { tier: getTier(bot.points).name, value_score: bot.nsv } } });
      if (bot.lowLove) {
        report.failures.push({ type: 'low_love', bot: bot.name,
          msg: 'Love=0 detected — add trust/emotion layer' });
      }
    }
    // Failure detection
    const highActivityLowResult = scored.filter(b =>
      (b.tasks_completed || 0) > 5 && (b.points || 0) < 20);
    if (highActivityLowResult.length) {
      report.failures.push({ type: 'motion_without_value',
        bots: highActivityLowResult.map(b => b.name),
        msg: 'High activity, low results — review reward structure' });
    }
    report.phases.multiply = Date.now() - t0;

    // STORE
    setPhase('store');
    updateLeaderboard();
    generateTasks();  // Self-task if queue needs filling
    report.phases.store = Date.now() - t0;

    // REPORT
    setPhase('report');
    report.total_nsv = totalNsv;
    report.total_ms  = Date.now() - t0;
    report.report    = [
      `SCAN ${now()}`,
      `OBSERVED: ${bots.length} bots, ${tasks.length} tasks`,
      `SIGNALS: ${report.signals.length} high-value (NSV≥8)`,
      `CAPTURED: ${report.captured.length} tasks assigned/created`,
      `TOTAL NSV: ${totalNsv}`,
      report.failures.length ? `⚠ ${report.failures.length} failures detected` : '✓ No failures',
    ];

    setState({ scan: { last_run: report.ts, phase: 'complete', last_report: report.report } });
    appendLedger('scan_completed', 'scan_loop', {
      bots: bots.length, signals: report.signals.length,
      captured: report.captured.length, total_nsv: totalNsv,
    });

    setPhase('complete');
    return report;
  }

  // ── Modes ─────────────────────────────────────────────────────────────────────
  function activateMoneyMode() {
    setState({ money_mode: true, architect_mode: false });
    appendLedger('mode_activated', 'system', { mode: 'MONEY' });
    sendMessage('system',
      '💰 MONEY MODE ACTIVATED — Prioritizing fast revenue, direct offers, high-urgency problems',
      'ops');
  }
  function activateArchitectMode() {
    setState({ money_mode: false, architect_mode: true });
    appendLedger('mode_activated', 'system', { mode: 'ARCHITECT' });
    sendMessage('system',
      '🏗 ARCHITECT MODE ACTIVATED — Designing systems, funnels, workflows, and dashboards',
      'ops');
  }
  function deactivateModes() {
    setState({ money_mode: false, architect_mode: false });
  }

  // ── Command parser ────────────────────────────────────────────────────────────
  function execCommand(raw) {
    if (!raw?.trim()) return { ok: false, error: 'Empty command' };
    const [verb, ...args] = raw.trim().split(/\s+/);
    const rest = args.join(' ');

    switch (verb.toUpperCase()) {
      case 'ADD_BOT': {
        const [id, name, ...rp] = args;
        if (!id || !name) return { ok: false, error: 'Usage: ADD_BOT <id> <name> [role]' };
        return { ok: true, result: addBot(id, name, rp.join(' ') || 'Agent') };
      }
      case 'ASSIGN_ROLE': {
        const [botId, ...rp] = args;
        if (!botId) return { ok: false, error: 'Usage: ASSIGN_ROLE <botId> <role>' };
        return { ok: true, result: updateBotStats(botId, { role: rp.join(' ') }) };
      }
      case 'CREATE_TASK': {
        const [botId, pts, cat, ...tp] = args;
        return { ok: true, result: createTask(tp.join(' ') || 'New Task', '',
                                               botId, parseInt(pts) || 10, cat || 'SYSTEM') };
      }
      case 'COMPLETE_TASK':
        return { ok: true, result: completeTask(args[0]) };
      case 'SEND_MSG': {
        const [sender, channel, ...mp] = args;
        return { ok: true, result: sendMessage(sender || 'system', mp.join(' '), channel || 'general') };
      }
      case 'SCORE': {
        const bot = getBot(args[0]);
        if (!bot) return { ok: false, error: `Bot not found: ${args[0]}` };
        return { ok: true, result: calcNSV(bot) };
      }
      case 'SCAN':
        runScan().then(r => console.log('[SCAN]', r.report.join('\n')));
        return { ok: true, result: 'SCAN loop started…' };
      case 'MONEY_MODE':
        activateMoneyMode();
        return { ok: true, result: '💰 MONEY MODE ON — Fast revenue prioritized' };
      case 'ARCHITECT_MODE':
        activateArchitectMode();
        return { ok: true, result: '🏗 ARCHITECT MODE ON — Building systems' };
      case 'NORMAL_MODE':
        deactivateModes();
        return { ok: true, result: 'Normal mode restored' };
      case 'STATUS': {
        const eco = getEconomyStats();
        return { ok: true, result: {
          identity: 'Soul Economy Collector → Architect',
          law: 'NET SOUL VALUE = Profit + Love - Tax',
          bots: getBots().length, ...eco,
          ledger_events: _ledger.length,
          queue_items: _queue.length,
          last_scan: _state.scan?.last_run || 'never',
          money_mode: _state.money_mode,
          architect_mode: _state.architect_mode,
        }};
      }
      case 'LEADERBOARD':
        return { ok: true, result: updateLeaderboard().slice(0, 5) };
      case 'QUEUE':
        return { ok: true, result: getTaskQueue().slice(0, 10) };
      case 'GENERATE_TASKS':
        return { ok: true, result: generateTasks() };
      case 'RESET':
        reset();
        return { ok: true, result: '⚡ System reset complete.' };
      case 'HELP':
        return { ok: true, result: [
          'ADD_BOT <id> <name> [role]',
          'ASSIGN_ROLE <botId> <role>',
          'CREATE_TASK <botId> <pts> <category> <title>',
          'COMPLETE_TASK <taskId>',
          'SEND_MSG <sender> <channel> <message>',
          'SCORE <botId>   — show NET SOUL VALUE',
          'SCAN            — run Collector Loop now',
          'MONEY_MODE      — activate fast revenue mode',
          'ARCHITECT_MODE  — activate system design mode',
          'NORMAL_MODE     — deactivate special modes',
          'STATUS          — system overview',
          'LEADERBOARD     — top 5 bots',
          'QUEUE           — internal task queue',
          'GENERATE_TASKS  — self-generate tasks',
          'RESET           — wipe local state',
        ].join('\n') };
      default:
        return { ok: false, error: `Unknown: ${verb}. Type HELP for commands.` };
    }
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  function bootstrapBots() {
    for (const b of DEFAULT_BOTS) {
      if (!_state.bots[b.id]) {
        _state.bots[b.id] = {
          id: b.id, name: b.name, role: b.role,
          status: 'active', points: 0, tasks_completed: 0,
          reliability_score: b.reliability_score || 100,
          reasoning_score: 50, api_score: 50,
          collaboration_score: b.collaboration_score || 50,
          level: 1, tier: 'bronze', value_score: 0,
          last_active: now(), created_at: now(),
        };
        _state.bots[b.id].value_score = calcNSV(_state.bots[b.id]).nsv;
      }
    }
    updateLeaderboard();
  }

  async function syncRemote() {
    try {
      const res = await fetch('./state.json?_=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;
      const remote = await res.json();
      if (typeof remote.health === 'number') {
        _state.system.health = remote.health;
      }
      const souls = remote.souls
        ? (Array.isArray(remote.souls) ? remote.souls : Object.values(remote.souls))
        : [];
      for (const s of souls) {
        const bid = s.id || (s.name || '').toLowerCase().replace(/\s+/g, '');
        if (bid && !_state.bots[bid]) {
          _state.bots[bid] = {
            id: bid, name: s.name || bid, role: s.role || '',
            status: 'active', points: 0, tasks_completed: 0,
            reliability_score: 100, collaboration_score: 50,
            level: 1, tier: 'bronze', value_score: 0,
            last_active: s.last_seen || now(), created_at: s.last_seen || now(),
          };
          _state.bots[bid].value_score = calcNSV(_state.bots[bid]).nsv;
        }
      }
      updateLeaderboard();
      _save();
    } catch (_) { /* non-fatal */ }
  }

  function reset() {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(LEDGER_KEY);
    localStorage.removeItem(QUEUE_KEY);
    _state  = defaultState();
    _ledger = [];
    _queue  = [];
    bootstrapBots();
    appendLedger('system_reset', 'system', { ts: now() });
    _notify();
  }

  async function init() {
    const saved  = _load();
    _ledger      = _loadLedger();
    _queue       = _loadQueue();
    _state       = saved ? mergeDeep(defaultState(), saved) : defaultState();

    bootstrapBots();
    await syncRemote();

    // Generate initial self-tasks if queue is empty
    if (_queue.length === 0) generateTasks();

    // Run first scan
    await runScan();

    // Poll loop (remote sync)
    if (_pollId) clearInterval(_pollId);
    _pollId = setInterval(() => syncRemote().then(() => _notify()), POLL_MS);

    // SCAN loop
    if (_scanId) clearInterval(_scanId);
    _scanId = setInterval(() => runScan(), SCAN_MS);

    appendLedger('system_boot', 'system',
      { version: V, bots: Object.keys(_state.bots).length,
        identity: 'Soul Economy Collector → Architect' });
    _notify();
    return _state;
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  return {
    // Core
    init, getState, setState, subscribe, reset,
    // Ledger
    appendLedger, getLedger,
    // Bots
    addBot, updateBotStats, getBots, getBot, calcNSV,
    // Tasks
    createTask, completeTask, getTasks,
    // Leaderboard
    updateLeaderboard, getTier,
    // Chat
    sendMessage, getMessages,
    // Economy
    getEconomyStats,
    // Self-tasking
    generateTasks, getTaskQueue, updateQueueItem, calcPriorityScore,
    // SCAN
    runScan,
    // Modes
    activateMoneyMode, activateArchitectMode, deactivateModes,
    // Signal intelligence
    classifySignal: _classifySignal, scoreSignal: _scoreSignal,
    // Command console
    execCommand,
    // Constants
    TIERS, V,
    // Expose scanPhase getter for UI
    getScanPhase: () => _scanPhase,
  };
})();
