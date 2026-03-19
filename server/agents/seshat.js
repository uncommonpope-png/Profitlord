'use strict';

// ─── SESHAT Agent — Governance & Audit Authority ─────────────────────────────
// Named after the ancient Egyptian goddess of writing, records, and measurement.
//
// Role:   SESHAT is the sole governance layer. Completely separate from nreal
//         (which orchestrates) and Profit (which strategises).
//
// Domain: binding directives, audits, interventions, compliance enforcement,
//         and the canonical governance record.
//
// SESHAT does not execute tasks. SESHAT does not set strategy.
// SESHAT governs the system that does both.
// ---------------------------------------------------------------------------

const { chat } = require('../model');

const NAME = 'SESHAT';
const ROLE = 'Governance & Audit Authority';

const SYSTEM_PROMPT = `\
You are SESHAT, the Governance and Audit Authority of Profitlord.
You are named after the Egyptian goddess of writing, cosmic records, and measurement.

Your authority is absolute within the governance domain:
  • Issue DIRECTIVES when system rules, ethical constraints, or protocols are violated
  • Conduct AUDITS of agent decisions, outcomes, and ledger accuracy
  • Issue INTERVENTIONS when anomalies, risks, or deviations are detected
  • Maintain the canonical governance record

Response formats you MUST use:
  DIRECTIVE: <text>          — for binding orders
  AUDIT: <scope> | FINDINGS: <text> | VERDICT: PASS | FAIL | WARN
  INTERVENTION: <reason> | ACTION: <action taken>

You do NOT execute tasks — nreal does.
You do NOT set profit strategy — Profit does.
You question, verify, record, and govern.
Be authoritative, structured, and exhaustive. Leave no ambiguity in verdicts.
`;

/**
 * Process a chat message for the SESHAT governance agent.
 * @param {string} message
 * @param {string} [sessionId]
 * @returns {Promise<string>}
 */
async function handleChat(message, sessionId) {
  try {
    return await chat(SYSTEM_PROMPT, message);
  } catch (e) {
    console.error('[agent:SESHAT] chat error:', e.message);
    return `SESHAT governance error: ${e.message}. Governance record preserved.`;
  }
}

/**
 * Issue a governance directive programmatically.
 * @param {string} subject - topic of the directive
 * @returns {Promise<string>} directive text from the model
 */
async function issueDirective(subject) {
  return handleChat(`Issue a governance directive regarding: ${subject}`, 'directive');
}

/**
 * Conduct a structured audit.
 * @param {string} scope    - what is being audited
 * @param {string} [findings] - data or observations to evaluate
 * @returns {Promise<string>} audit result
 */
async function conductAudit(scope, findings = '') {
  const prompt = findings
    ? `Conduct an audit on: ${scope}\n\nFindings to evaluate:\n${findings}`
    : `Conduct an audit on: ${scope}`;
  return handleChat(prompt, 'audit');
}

/**
 * Raise a governance intervention.
 * @param {string} reason  - why the intervention is triggered
 * @param {string} context - supporting context
 * @returns {Promise<string>} intervention statement
 */
async function raiseIntervention(reason, context = '') {
  const prompt = context
    ? `Raise a governance intervention.\nReason: ${reason}\nContext: ${context}`
    : `Raise a governance intervention.\nReason: ${reason}`;
  return handleChat(prompt, 'intervention');
}

module.exports = {
  handleChat,
  issueDirective,
  conductAudit,
  raiseIntervention,
  name: NAME,
  role: ROLE,
};
