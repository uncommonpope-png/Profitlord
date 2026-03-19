'use strict';

// ---------------------------------------------------------------------------
// telegram.js — Profitlord outbound Telegram messenger
//
// Reads credentials from environment only — never from source code:
//   BOT_TOKEN  — Telegram bot token from @BotFather
//   CHAT_ID    — Telegram chat/user ID to deliver messages to
//
// Usage:
//   const { sendMessage, getUpdates } = require('./telegram');
//   await sendMessage('Hello from Profitlord');
// ---------------------------------------------------------------------------

const https = require('https');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const CHAT_ID   = process.env.CHAT_ID   || '';

// ─── Throttle & dedup ───────────────────────────────────────────────────────

const THROTTLE_MS     = 10_000;   // minimum gap between any two outbound messages
const DEDUP_WINDOW_MS = 60_000;   // suppress identical text within this window

const recentHashes = new Map();   // hash → expiry timestamp
let   lastSentAt   = 0;

function djb2(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function isDuplicate(text) {
  const key    = djb2(text);
  const expiry = recentHashes.get(key);
  if (expiry && Date.now() < expiry) return true;
  recentHashes.set(key, Date.now() + DEDUP_WINDOW_MS);
  // prune stale entries
  for (const [k, v] of recentHashes) if (Date.now() > v) recentHashes.delete(k);
  return false;
}

function isThrottled() {
  return Date.now() - lastSentAt < THROTTLE_MS;
}

// ─── Core send ──────────────────────────────────────────────────────────────

/**
 * sendMessage(text)
 *
 * Sends `text` to CHAT_ID via the Telegram Bot API.
 * Never throws — all errors are caught, logged, and returned as { ok: false }.
 *
 * Returns Promise<{ ok: boolean, sent: boolean, reason?: string }>
 */
async function sendMessage(text) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('[TG] skipped — BOT_TOKEN or CHAT_ID not set');
    return { ok: false, sent: false, reason: 'not_configured' };
  }
  if (isThrottled()) {
    console.warn('[TG] throttled — too soon after last message');
    return { ok: false, sent: false, reason: 'throttled' };
  }
  if (isDuplicate(text)) {
    console.warn('[TG] dedup — identical message sent recently, skipping');
    return { ok: false, sent: false, reason: 'duplicate' };
  }

  const payload = JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' });

  return new Promise(resolve => {
    const opts = {
      hostname: 'api.telegram.org',
      path:     `/bot${BOT_TOKEN}/sendMessage`,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent':     'profitlord-server/1.0',
      },
    };

    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        lastSentAt = Date.now();
        let body;
        try { body = JSON.parse(raw); } catch { body = { raw }; }

        if (res.statusCode >= 200 && res.statusCode < 300 && body.ok) {
          console.log(`[TG] sent ok — ${text.length} chars`);
          resolve({ ok: true, sent: true });
        } else {
          const reason = (body && body.description) || String(res.statusCode);
          console.error(`[TG] send failed: ${reason}`);
          resolve({ ok: false, sent: false, reason });
        }
      });
    });

    req.on('error', err => {
      console.error('[TG] request error:', err.message);
      resolve({ ok: false, sent: false, reason: err.message });
    });

    req.write(payload);
    req.end();
  });
}

// ─── Setup helper ───────────────────────────────────────────────────────────

/**
 * getUpdates()
 *
 * Calls Telegram getUpdates to retrieve recent messages.
 * Used by GET /telegram/setup to discover CHAT_ID automatically.
 * The user must have sent at least one message to the bot first.
 */
async function getUpdates() {
  if (!BOT_TOKEN) return null;
  return new Promise(resolve => {
    const opts = {
      hostname: 'api.telegram.org',
      path:     `/bot${BOT_TOKEN}/getUpdates`,
      method:   'GET',
      headers:  { 'User-Agent': 'profitlord-server/1.0' },
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

module.exports = { sendMessage, getUpdates };
