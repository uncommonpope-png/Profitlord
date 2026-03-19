'use strict';

// ─── Telegram Sender ─────────────────────────────────────────────────────────
// Sends messages to a Telegram chat via the Bot API.
//
// Required env vars:
//   TELEGRAM_BOT_TOKEN  — Telegram Bot API token (from @BotFather)
//   TELEGRAM_CHAT_ID    — Target chat or channel ID
// ---------------------------------------------------------------------------

const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID   || '';

const isConfigured = Boolean(BOT_TOKEN && CHAT_ID);

if (!isConfigured) {
  console.warn('[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — Telegram notifications disabled.');
}

function tgRequest(method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'api.telegram.org',
      path:     `/bot${BOT_TOKEN}/${method}`,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent':     'profitlord-server/1.0',
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

/**
 * Send a text message to the configured Telegram chat.
 *
 * @param {string} text
 * @param {object} [options]
 * @param {string} [options.parseMode] - 'HTML' | 'Markdown' | 'MarkdownV2'
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function sendMessage(text, options = {}) {
  if (!isConfigured) {
    console.log('[telegram] (not configured) would send:', text.slice(0, 80));
    return { ok: false, error: 'not configured' };
  }

  try {
    const body = { chat_id: CHAT_ID, text };
    if (options.parseMode) body.parse_mode = options.parseMode;

    const r = await tgRequest('sendMessage', body);
    if (r.status === 200 && r.body?.ok) {
      return { ok: true };
    }
    const err = r.body?.description || `HTTP ${r.status}`;
    console.error('[telegram] sendMessage failed:', err);
    return { ok: false, error: err };
  } catch (e) {
    console.error('[telegram] sendMessage error:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { sendMessage, isConfigured };
