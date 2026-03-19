'use strict';

// ---------------------------------------------------------------------------
// server/agents/profit.js — Profit Agent (Chief Profit Officer)
//
// Responsibilities:
//   • Answer strategy / revenue / pricing / PLT questions via LLM
//   • Produce structured directives on request
//   • Expose a `chat(message, sessionId)` function used by index.js
// ---------------------------------------------------------------------------

const model = require('../model');

const SYSTEM_PROMPT = `You are Profit, the Chief Profit Officer for Profitlord.
Your role is to maximise revenue and strategic advantage for the user's projects.
Focus areas: pricing strategy, revenue models, PLT (profit-loss tracking), deal scoring.
Be direct, data-driven, and actionable. Always close with a clear next step.`;

/**
 * Process a chat message and return a reply string.
 *
 * @param {string} message
 * @param {string} [sessionId]
 * @returns {Promise<string>}
 */
async function chat(message, sessionId = '') {
  const context = sessionId ? `[session:${sessionId}] ` : '';
  console.log(`[Profit] ${context}chat: ${message.slice(0, 120)}`);
  return model.complete(SYSTEM_PROMPT, message, { maxTokens: 512 });
}

/**
 * Generate a strategic directive for a given objective.
 *
 * @param {string} objective
 * @returns {Promise<{ directive: string, ts: string }>}
 */
async function directive(objective) {
  const prompt = `Generate a concise strategic directive for: "${objective}". 
Return JSON: { "directive": "<one sentence action>", "reasoning": "<why>", "kpi": "<metric to track>" }`;
  const raw = await model.complete(SYSTEM_PROMPT, prompt, { maxTokens: 256 });
  return { directive: raw, ts: new Date().toISOString() };
}

module.exports = { chat, directive, name: 'Profit' };
