'use strict';

// ---------------------------------------------------------------------------
// server/messaging.js — Proactive messaging hub
//
// Responsibilities:
//   • Proactive send  — push a message to Telegram
//   • Heartbeat       — periodic keepalive ping every HEARTBEAT_INTERVAL_MS
//   • Duplicate guard — drop identical messages sent within DEDUP_WINDOW_MS
//
// Required env vars (see telegram.js):
//   TELEGRAM_BOT_TOKEN
//   TELEGRAM_CHAT_ID
// Optional:
//   HEARTBEAT_INTERVAL_MS — default 5 minutes (300 000)
//   DEDUP_WINDOW_MS       — default 60 seconds (60 000)
// ---------------------------------------------------------------------------

const crypto   = require('crypto');
const telegram = require('./telegram');

const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '300000', 10);
const DEDUP_WINDOW_MS       = parseInt(process.env.DEDUP_WINDOW_MS       || '60000',  10);

// ── Duplicate prevention ───────────────────────────────────────────────────
// Map<hash, sentAtMs>
const _sentCache = new Map();

function _hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function _isDuplicate(text) {
  const h   = _hash(text);
  const now = Date.now();

  // Purge expired entries
  for (const [key, ts] of _sentCache) {
    if (now - ts > DEDUP_WINDOW_MS) _sentCache.delete(key);
  }

  if (_sentCache.has(h)) return true;
  _sentCache.set(h, now);
  return false;
}

// ── Proactive send ─────────────────────────────────────────────────────────

/**
 * Send a message proactively.  Drops duplicates within DEDUP_WINDOW_MS.
 * Returns true if the message was sent, false if it was a duplicate or
 * Telegram is not configured.
 *
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function proactiveSend(text) {
  if (!text) return false;

  if (_isDuplicate(text)) {
    console.log('[messaging] duplicate suppressed:', text.slice(0, 60));
    return false;
  }

  try {
    const result = await telegram.sendMessage(text);
    if (result.ok) {
      console.log('[messaging] sent:', text.slice(0, 80));
      return true;
    }
    console.warn('[messaging] send failed:', result.description || JSON.stringify(result).slice(0, 80));
    return false;
  } catch (e) {
    console.error('[messaging] send error:', e.message);
    return false;
  }
}

// ── Heartbeat ──────────────────────────────────────────────────────────────

let _heartbeatTimer = null;

/**
 * Start the periodic heartbeat.  Idempotent — calling multiple times is safe.
 */
function startHeartbeat() {
  if (_heartbeatTimer) return;
  console.log(`[messaging] heartbeat started — interval ${HEARTBEAT_INTERVAL_MS}ms`);

  _heartbeatTimer = setInterval(() => {
    const ts = new Date().toISOString();
    proactiveSend(`💓 Profitlord heartbeat — ${ts}`).catch(() => {});
  }, HEARTBEAT_INTERVAL_MS);

  // Allow the process to exit even if the timer is active
  if (_heartbeatTimer.unref) _heartbeatTimer.unref();
}

/**
 * Stop the heartbeat timer (useful in tests).
 */
function stopHeartbeat() {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
}

module.exports = { proactiveSend, startHeartbeat, stopHeartbeat };
