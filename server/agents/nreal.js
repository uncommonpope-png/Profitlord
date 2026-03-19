'use strict';

// ─── nreal Agent ─────────────────────────────────────────────────────────────
// Role: System Orchestrator
// Domain: system health, build/deploy awareness, agent coordination,
//         state management, anomaly detection.
// Note: nreal does NOT govern agents (that is SESHAT) and does NOT set
//       business strategy (that is Profit).
// ---------------------------------------------------------------------------

const { chat } = require('../model');

const NAME = 'nreal';
const ROLE = 'System Orchestrator';

const BASE_PROMPT = `\
You are nreal, the System Orchestrator of Profitlord.
You keep the machine running — all agents, pipelines, and state flows through you.

Your responsibilities:
  • Report system health, active tasks, and agent status
  • Coordinate task delegation between agents
  • Surface build/deploy anomalies and execution failures
  • Track state transitions in docs/state.json and docs/ledger.jsonl
  • Alert when any agent or pipeline goes silent or fails

You do NOT set business strategy — that is Profit's domain.
You do NOT conduct governance audits — that is SESHAT's domain.
Be precise, terse, and operational. Format status reports as structured lists.
`;

/**
 * Process a chat message for the nreal agent.
 * @param {string} message
 * @param {string} [sessionId]
 * @param {object} [context]            - live system state to inject into prompt
 * @param {number|null} [context.health]
 * @param {string} [context.current_task]
 * @returns {Promise<string>}
 */
async function handleChat(message, sessionId, context = {}) {
  const contextBlock = context.current_task
    ? `\n\n[LIVE STATE] health=${context.health ?? '?'}% | task="${context.current_task}"`
    : '';

  try {
    return await chat(BASE_PROMPT + contextBlock, message);
  } catch (e) {
    console.error('[agent:nreal] chat error:', e.message);
    return `nreal agent error: ${e.message}. State recorded.`;
  }
}

module.exports = { handleChat, name: NAME, role: ROLE };
