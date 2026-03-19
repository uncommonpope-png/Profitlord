'use strict';

// ---------------------------------------------------------------------------
// server/telegram.js — Telegram notification sender
//
// Required env vars:
//   TELEGRAM_BOT_TOKEN  — Bot token from @BotFather
//   TELEGRAM_CHAT_ID    — Target chat / channel ID
//
// When either env var is absent, isConfigured() returns false and send()
// logs a warning instead of attempting a network call.
// ---------------------------------------------------------------------------

const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID   || '';

function isConfigured() {
  return Boolean(BOT_TOKEN && CHAT_ID);
}

/**
 * Send a plain-text message to the configured Telegram chat.
 * Resolves with the Telegram API response body.
 * Rejects on network error; callers should treat this as fire-and-forget.
 *
 * @param {string} text
 * @returns {Promise<object>}
 */
function sendMessage(text) {
  if (!isConfigured()) {
    console.warn('[Telegram] not configured — TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing');
    return Promise.resolve({ ok: false, description: 'not configured' });
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' });
    const path = `/bot${BOT_TOKEN}/sendMessage`;

    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      res => {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch { resolve({ ok: false, raw }); }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { sendMessage, isConfigured };
