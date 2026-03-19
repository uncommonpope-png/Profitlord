'use strict';

// ─── Messaging Coordinator ───────────────────────────────────────────────────
// Handles:
//   • Proactive Telegram sends with duplicate prevention
//   • Heartbeat — periodic system status broadcasts
//
// Required env vars (consumed by telegram.js):
//   TELEGRAM_BOT_TOKEN
//   TELEGRAM_CHAT_ID
//
// Optional env vars:
//   HEARTBEAT_INTERVAL_MS  — heartbeat period in ms (default: 3600000 = 1h; 0 = disabled)
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const { sendMessage, isConfigured } = require('./telegram');

const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '3600000', 10);
const DEDUP_TTL_MS          = 60 * 60 * 1000; // 1 hour

// Dedup store: md5(text) → expiry timestamp
const _recentHashes = new Map();
let   _heartbeatTimer = null;

// Status provider — replaced by registerStatusProvider()
let _getStatus = () => ({ health: null, current_task: 'idle' });

// ─── Dedup helpers ───────────────────────────────────────────────────────────

function _hash(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

/**
 * Returns true if this exact text was already sent within DEDUP_TTL_MS.
 * Side-effect: records the hash on first call.
 * @param {string} text
 * @returns {boolean}
 */
function isDuplicate(text) {
  const h      = _hash(text);
  const expiry = _recentHashes.get(h);
  if (expiry && Date.now() < expiry) return true;

  _recentHashes.set(h, Date.now() + DEDUP_TTL_MS);

  // Prune expired entries
  for (const [k, exp] of _recentHashes) {
    if (Date.now() > exp) _recentHashes.delete(k);
  }
  return false;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Send a proactive message to Telegram with duplicate prevention.
 *
 * @param {string} text
 * @param {object} [options]
 * @param {boolean} [options.allowDuplicate] - bypass dedup (default: false)
 * @param {string}  [options.parseMode]      - 'HTML' | 'Markdown'
 * @returns {Promise<{ok: boolean, duplicate?: boolean, error?: string}>}
 */
async function proactiveSend(text, options = {}) {
  if (!options.allowDuplicate && isDuplicate(text)) {
    console.log('[messaging] duplicate suppressed:', text.slice(0, 60));
    return { ok: false, duplicate: true };
  }
  return sendMessage(text, { parseMode: options.parseMode });
}

/**
 * Register a callback that returns current system status for heartbeat messages.
 * The callback must return { health: number|null, current_task: string }.
 * @param {function(): {health: number|null, current_task: string}} fn
 */
function registerStatusProvider(fn) {
  _getStatus = fn;
}

async function _sendHeartbeat() {
  const status = _getStatus();
  const health = status.health !== null && status.health !== undefined
    ? `${status.health}%`
    : '?';
  const text = [
    '💓 PROFITLORD HEARTBEAT',
    `Health: ${health}`,
    `Task:   ${(status.current_task || 'idle').slice(0, 80)}`,
    `Time:   ${new Date().toISOString()}`,
  ].join('\n');
  console.log('[messaging] sending heartbeat');
  return proactiveSend(text, { allowDuplicate: true });
}

/**
 * Start the periodic heartbeat.
 * Sends first heartbeat after 30 s (startup grace period), then every HEARTBEAT_INTERVAL_MS.
 * No-op if Telegram is not configured or HEARTBEAT_INTERVAL_MS === 0.
 */
function startHeartbeat() {
  if (!isConfigured || HEARTBEAT_INTERVAL_MS <= 0) {
    console.log('[messaging] heartbeat disabled' +
      (!isConfigured ? ' (Telegram not configured)' : ' (HEARTBEAT_INTERVAL_MS=0)'));
    return;
  }
  if (_heartbeatTimer) return; // already running

  console.log(`[messaging] heartbeat every ${HEARTBEAT_INTERVAL_MS}ms`);

  // Grace period: first beat 30 s after server start
  setTimeout(() => {
    _sendHeartbeat().catch(e => console.error('[messaging] heartbeat error:', e.message));
    _heartbeatTimer = setInterval(
      () => _sendHeartbeat().catch(e => console.error('[messaging] heartbeat error:', e.message)),
      HEARTBEAT_INTERVAL_MS
    );
  }, 30_000);
}

function stopHeartbeat() {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
}

module.exports = {
  proactiveSend,
  startHeartbeat,
  stopHeartbeat,
  registerStatusProvider,
  isDuplicate,
};
