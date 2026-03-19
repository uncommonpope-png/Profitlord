/**
 * Profitlord Soul Economy — API Service Layer v2.0
 * ==================================================
 * Tries Cloudflare Worker API first.
 * Falls back to ProfitlordOS (localStorage) if Worker unavailable.
 * Same interface regardless of backend availability.
 *
 * Usage: await PLTApi.bots.list()
 *        await PLTApi.tasks.complete(id)
 *        await PLTApi.leaderboard.get()
 *
 * Exposed as: window.PLTApi
 */
'use strict';

const PLTApi = (() => {
  // ── Configuration ─────────────────────────────────────────────────────────
  // Replace with your deployed Worker URL after running `wrangler deploy`
  const WORKER_URL = (
    window.PLT_WORKER_URL ||           // set globally before this script
    localStorage.getItem('plt_worker_url') ||
    'https://profitlord-worker.REPLACE.workers.dev'
  ).replace(/\/$/, '');

  const TIMEOUT_MS   = 5_000;
  let   _workerAlive = null;  // null=unknown, true=reachable, false=unreachable
  let   _lastCheck   = 0;
  const CHECK_TTL    = 60_000; // re-check worker availability every 60 s

  // ── Internal helpers ───────────────────────────────────────────────────────
  async function _fetch(path, opts) {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(WORKER_URL + path, {
        ...opts,
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
      });
      clearTimeout(tid);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw Object.assign(new Error(err.error || res.statusText), { status: res.status });
      }
      return res.json();
    } finally {
      clearTimeout(tid);
    }
  }

  async function _isWorkerAlive() {
    if (Date.now() - _lastCheck < CHECK_TTL && _workerAlive !== null) {
      return _workerAlive;
    }
    try {
      await fetch(WORKER_URL + '/api/health', { method: 'GET',
        signal: AbortSignal.timeout?.(3000) || AbortSignal.abort() });
      _workerAlive = true;
    } catch (_) {
      _workerAlive = false;
    }
    _lastCheck = Date.now();
    return _workerAlive;
  }

  /** Runs worker call; on failure falls back to OS */
  async function _call(path, opts, fallbackFn) {
    const alive = await _isWorkerAlive();
    if (alive) {
      try { return await _fetch(path, opts); }
      catch (e) { console.warn('[PLTApi] Worker error, falling back:', e.message); }
    }
    if (typeof ProfitlordOS === 'undefined') {
      throw new Error('ProfitlordOS not loaded and Worker unreachable');
    }
    return fallbackFn();
  }

  // ── Health ─────────────────────────────────────────────────────────────────
  const health = {
    async get() {
      return _call('/api/health', {}, () => ({
        status: 'ok (local)', service: 'profitlord-os',
        law: 'NET SOUL VALUE = Profit + Love - Tax',
        worker: 'offline (using localStorage)',
      }));
    },
  };

  // ── System state ───────────────────────────────────────────────────────────
  const system = {
    async getState() {
      return _call('/api/system/state', {}, () => {
        const s = ProfitlordOS.getState();
        return { ...s.system, bots: s.economy, scan: s.scan };
      });
    },
    async setState(patch) {
      return _call('/api/system/state', { method: 'POST', body: JSON.stringify(patch) }, () => {
        ProfitlordOS.setState({ system: patch });
        return { ok: true };
      });
    },
  };

  // ── Bots ───────────────────────────────────────────────────────────────────
  const bots = {
    async list() {
      return _call('/api/bots', {}, () => ProfitlordOS.getBots());
    },
    async get(id) {
      return _call(`/api/bots/${id}`, {}, () => ProfitlordOS.getBot(id));
    },
    async create(data) {
      return _call('/api/bots', { method: 'POST', body: JSON.stringify(data) }, () =>
        ProfitlordOS.addBot(data.id || data.plt_name?.toLowerCase(), data.plt_name || data.name, data.role)
      );
    },
    async update(id, patch) {
      return _call(`/api/bots/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, () =>
        ProfitlordOS.updateBotStats(id, patch)
      );
    },
    async score(id) {
      return _call(`/api/bots/${id}`, {}, () => {
        const bot = ProfitlordOS.getBot(id);
        return bot ? ProfitlordOS.calcNSV(bot) : null;
      });
    },
  };

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const tasks = {
    async list(params) {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return _call(`/api/tasks${qs}`, {}, () => ProfitlordOS.getTasks(params));
    },
    async get(id) {
      return _call(`/api/tasks/${id}`, {}, () =>
        ProfitlordOS.getTasks().find(t => t.id === id) || null
      );
    },
    async create(data) {
      return _call('/api/tasks', { method: 'POST', body: JSON.stringify(data) }, () =>
        ProfitlordOS.createTask(data.title, data.description, data.assigned_bot_id,
                                data.reward_points, data.category)
      );
    },
    async update(id, patch) {
      return _call(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, () => {
        if (patch.status === 'complete') return ProfitlordOS.completeTask(id);
        // Generic patch not directly supported in OS — just complete
        return ProfitlordOS.completeTask(id);
      });
    },
    async complete(id) {
      return tasks.update(id, { status: 'complete' });
    },
  };

  // ── Leaderboard ────────────────────────────────────────────────────────────
  const leaderboard = {
    async get() {
      return _call('/api/leaderboard', {}, () => ProfitlordOS.updateLeaderboard());
    },
  };

  // ── Chat ───────────────────────────────────────────────────────────────────
  const chat = {
    async getMessages(channel, limit) {
      const qs = '?' + new URLSearchParams({ channel: channel || 'general',
                                             limit: limit || 50 }).toString();
      return _call(`/api/chat/messages${qs}`, {}, () =>
        ProfitlordOS.getMessages(channel || 'general')
      );
    },
    async send(senderBotId, content, channel) {
      return _call('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ sender_bot_id: senderBotId, content, channel: channel || 'general' }),
      }, () => ProfitlordOS.sendMessage(senderBotId, content, channel || 'general'));
    },
  };

  // ── Events ─────────────────────────────────────────────────────────────────
  const events = {
    async list(params) {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return _call(`/api/events${qs}`, {}, () => ProfitlordOS.getLedger(params));
    },
    async log(eventType, actorId, payload) {
      return _call('/api/events', {
        method: 'POST',
        body: JSON.stringify({ event_type: eventType, actor_id: actorId, payload }),
      }, () => {
        ProfitlordOS.appendLedger(eventType, actorId, payload);
        return { ok: true };
      });
    },
  };

  // ── Task queue (self-tasking) ─────────────────────────────────────────────
  const queue = {
    async list(status) {
      const qs = status ? `?status=${status}` : '';
      return _call(`/api/task-queue${qs}`, {}, () => ProfitlordOS.getTaskQueue({ status }));
    },
    async create(data) {
      return _call('/api/task-queue', { method: 'POST', body: JSON.stringify(data) }, () => {
        const items = ProfitlordOS.generateTasks();
        return items[0] || null;
      });
    },
  };

  // ── Scan ───────────────────────────────────────────────────────────────────
  const scan = {
    async run() {
      return _call('/api/scan', { method: 'POST' }, () => ProfitlordOS.runScan());
    },
    async getLast() {
      return _call('/api/scan/last', {}, () => ({
        last_run: ProfitlordOS.getState().scan?.last_run,
        last_report: ProfitlordOS.getState().scan?.last_report,
      }));
    },
  };

  // ── Worker config ──────────────────────────────────────────────────────────
  function setWorkerUrl(url) {
    localStorage.setItem('plt_worker_url', url);
    _workerAlive = null;
    _lastCheck   = 0;
    console.log('[PLTApi] Worker URL set to:', url);
  }

  function getWorkerStatus() {
    return { url: WORKER_URL, alive: _workerAlive, last_check: new Date(_lastCheck).toISOString() };
  }

  return {
    health, system, bots, tasks, leaderboard, chat, events, queue, scan,
    setWorkerUrl, getWorkerStatus,
    // Quick access
    isWorkerAlive: _isWorkerAlive,
  };
})();
