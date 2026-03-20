'use strict';

// ---------------------------------------------------------------------------
// server/model.js — LLM integration
//
// Required env vars (at least one provider must be set for live mode):
//   OPENAI_API_KEY  — OpenAI API key (gpt-4o / gpt-3.5-turbo)
//   MODEL_NAME      — (optional) override model name, default: gpt-4o
//
// If no key is set, complete() returns a placeholder response so the rest
// of the system can operate without a live model.
// ---------------------------------------------------------------------------

const https = require('https');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const MODEL_NAME     = process.env.MODEL_NAME || 'gpt-4o';

function isLive() {
  return Boolean(OPENAI_API_KEY);
}

/**
 * Call the OpenAI chat-completions endpoint.
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {{ maxTokens?: number }} [opts]
 * @returns {Promise<string>}
 */
function callOpenAI(systemPrompt, userMessage, opts = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL_NAME,
      max_tokens: opts.maxTokens || 512,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
    });

    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      res => {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            const text = parsed.choices?.[0]?.message?.content || '';
            if (!text) return reject(new Error(`OpenAI error: ${raw.slice(0, 200)}`));
            resolve(text.trim());
          } catch (e) {
            reject(new Error(`OpenAI parse error: ${e.message}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Generate a completion.  Falls back to a placeholder when no API key is set.
 *
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {{ maxTokens?: number }} [opts]
 * @returns {Promise<string>}
 */
async function complete(systemPrompt, userMessage, opts = {}) {
  if (!isLive()) {
    return `[PLACEHOLDER — model not configured] Received: "${userMessage.slice(0, 100)}"`;
  }
  return callOpenAI(systemPrompt, userMessage, opts);
}

module.exports = { complete, isLive, MODEL_NAME };
