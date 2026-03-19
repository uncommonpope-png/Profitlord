'use strict';

// ─── Model Integration ───────────────────────────────────────────────────────
// Supports OpenAI Chat Completions API and any compatible provider.
//
// Required env vars:
//   OPENAI_API_KEY   — API key (required for live mode)
//
// Optional env vars:
//   OPENAI_BASE_URL  — Base URL override (default: https://api.openai.com)
//   OPENAI_MODEL     — Model ID (default: gpt-4o-mini)
// ---------------------------------------------------------------------------

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const OPENAI_API_KEY  = process.env.OPENAI_API_KEY  || '';
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '');
const OPENAI_MODEL    = process.env.OPENAI_MODEL    || 'gpt-4o-mini';

const isLive = Boolean(OPENAI_API_KEY);

if (!isLive) {
  console.warn('[model] OPENAI_API_KEY not set — running in placeholder mode.');
}

function httpPost(urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const mod    = parsed.protocol === 'https:' ? https : http;
    const data   = JSON.stringify(body);
    const port   = parsed.port
      ? parseInt(parsed.port, 10)
      : parsed.protocol === 'https:' ? 443 : 80;

    const opts = {
      hostname: parsed.hostname,
      port,
      path: parsed.pathname + (parsed.search || ''),
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    };

    const req = mod.request(opts, res => {
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
 * Call the configured LLM with a system prompt and user message.
 * Returns the assistant reply string.
 * Falls back to a descriptive stub when OPENAI_API_KEY is not set.
 *
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {object} [options]
 * @param {number} [options.maxTokens]    - max completion tokens (default: 512)
 * @param {number} [options.temperature]  - sampling temperature (default: 0.7)
 * @returns {Promise<string>}
 */
async function chat(systemPrompt, userMessage, options = {}) {
  if (!isLive) {
    const preview = systemPrompt.slice(0, 50).replace(/\n/g, ' ').trim();
    return `[${OPENAI_MODEL} · placeholder] "${userMessage.slice(0, 100)}" — set OPENAI_API_KEY to enable live responses. (${preview}…)`;
  }

  const url = `${OPENAI_BASE_URL}/v1/chat/completions`;
  const r   = await httpPost(
    url,
    {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'User-Agent':    'profitlord-server/1.0',
    },
    {
      model:       OPENAI_MODEL,
      messages:    [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
      max_tokens:  options.maxTokens  !== undefined ? options.maxTokens  : 512,
      temperature: options.temperature !== undefined ? options.temperature : 0.7,
    }
  );

  if (r.status !== 200 || !r.body?.choices?.[0]?.message?.content) {
    const errMsg = r.body?.error?.message || `HTTP ${r.status}`;
    throw new Error(`model.chat failed: ${errMsg}`);
  }

  return r.body.choices[0].message.content.trim();
}

module.exports = { chat, isLive, model: OPENAI_MODEL };
