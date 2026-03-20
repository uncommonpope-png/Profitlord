'use strict';

// ---------------------------------------------------------------------------
// server/agents/nreal.js — nreal State Agent
//
// Responsibilities:
//   • Own the docs/state.json writeback lifecycle
//   • Provide a `chat(message)` interface for state-related queries
//   • Trigger state patches on behalf of other agents
//
// This module is intentionally separate from SESHAT (governance) and Profit
// (strategy).  nreal is the system's state-keeper and GitHub sync layer.
// ---------------------------------------------------------------------------

const model = require('../model');

const SYSTEM_PROMPT = `You are nreal, the state-management and persistence layer for Profitlord.
You track the health of all agents, manage state.json on GitHub, and answer questions
about the system's current operational status.
Be concise and technical. Report facts, not opinions.`;

/**
 * Process a chat message about system state and return a reply.
 *
 * @param {string} message
 * @param {string} [sessionId]
 * @returns {Promise<string>}
 */
async function chat(message, sessionId = '') {
  const context = sessionId ? `[session:${sessionId}] ` : '';
  console.log(`[nreal] ${context}chat: ${message.slice(0, 120)}`);
  return model.complete(SYSTEM_PROMPT, message, { maxTokens: 512 });
}

/**
 * Produce a state-health summary for a given snapshot.
 *
 * @param {object} state  — current state.json snapshot
 * @returns {Promise<string>}
 */
async function summarise(state) {
  const prompt = `Summarise the following system state in 2-3 sentences:\n${JSON.stringify(state, null, 2).slice(0, 800)}`;
  return model.complete(SYSTEM_PROMPT, prompt, { maxTokens: 256 });
}

module.exports = { chat, summarise, name: 'nreal' };
