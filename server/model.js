'use strict';

// ---------------------------------------------------------------------------
// model.js — OpenAI Responses API service layer
//
// Provides a single generateResponse() call used by all agents.
// Falls back gracefully when OPENAI_API_KEY is not set (returns null,
// caller uses its template message instead).
//
// Env vars:
//   OPENAI_API_KEY  — OpenAI secret key (required for AI-enriched messages)
//   OPENAI_MODEL    — model name (default: gpt-4.1)
// ---------------------------------------------------------------------------

const https = require('https');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL   = process.env.OPENAI_MODEL   || 'gpt-4.1';

// Keep agent responses concise — these are Telegram messages, not essays
const MAX_OUTPUT_TOKENS = 300;

/**
 * generateResponse(instructions, input)
 *
 * Calls the OpenAI Responses API with `instructions` as the system prompt
 * and `input` as the user message.
 *
 * Returns Promise<string|null>
 *   string — AI-generated reply text
 *   null   — OPENAI_API_KEY not set, or API call failed
 */
async function generateResponse(instructions, input) {
  if (!OPENAI_API_KEY) return null;

  const payload = JSON.stringify({
    model:             OPENAI_MODEL,
    instructions,
    input,
    max_output_tokens: MAX_OUTPUT_TOKENS,
  });

  return new Promise(resolve => {
    const opts = {
      hostname: 'api.openai.com',
      path:     '/v1/responses',
      method:   'POST',
      headers:  {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent':    'profitlord-server/1.0',
      },
    };

    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try {
          const body = JSON.parse(raw);
          // Responses API exposes output_text as a convenience field;
          // fall back to the nested path if missing
          const text = body.output_text
            || body.output?.[0]?.content?.[0]?.text
            || null;
          if (text) {
            console.log(`[model] ${OPENAI_MODEL} → ${text.length} chars`);
          } else {
            console.warn('[model] no text in response:', JSON.stringify(body).slice(0, 200));
          }
          resolve(text);
        } catch (e) {
          console.error('[model] parse error:', e.message);
          resolve(null);
        }
      });
    });

    req.on('error', err => {
      console.error('[model] request error:', err.message);
      resolve(null);
    });

    req.write(payload);
    req.end();
  });
}

module.exports = { generateResponse, OPENAI_MODEL };
