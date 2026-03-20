'use strict';

// ---------------------------------------------------------------------------
// server/agents/seshat.js — SESHAT Governance Agent
//
// SESHAT is explicitly separate from nreal (state) and Profit (strategy).
// SESHAT's mandate is governance: it audits agent behaviour, produces binding
// directives, and can raise interventions when rules are violated.
//
// Responsibilities:
//   • Audit — review a log or state snapshot and flag anomalies
//   • Directive — issue a governance rule / policy
//   • Intervention — escalate when a critical threshold is breached
//   • Chat — answer governance / compliance questions
// ---------------------------------------------------------------------------

const model = require('../model');

const SYSTEM_PROMPT = `You are SESHAT, the Governance Agent for Profitlord.
Your role is oversight, auditing, and enforcement of system integrity.
You are NOT responsible for revenue strategy (Profit) or state persistence (nreal).
You review agent actions, flag anomalies, and issue directives when compliance is required.
Be precise, formal, and unambiguous. Every output must include a severity level
(INFO | WARN | CRITICAL) and a recommended action.`;

/**
 * Chat interface for governance / compliance questions.
 *
 * @param {string} message
 * @param {string} [sessionId]
 * @returns {Promise<string>}
 */
async function chat(message, sessionId = '') {
  const context = sessionId ? `[session:${sessionId}] ` : '';
  console.log(`[SESHAT] ${context}chat: ${message.slice(0, 120)}`);
  return model.complete(SYSTEM_PROMPT, message, { maxTokens: 512 });
}

/**
 * Audit a state snapshot or ledger excerpt.
 * Returns a structured audit report.
 *
 * @param {object|string} subject — state snapshot or log text to audit
 * @returns {Promise<{ severity: string, findings: string, recommendation: string, ts: string }>}
 */
async function audit(subject) {
  const text = typeof subject === 'string' ? subject : JSON.stringify(subject, null, 2).slice(0, 1200);
  const prompt = `Audit the following system data for anomalies, policy violations, or risks.
Return JSON: { "severity": "INFO|WARN|CRITICAL", "findings": "<summary>", "recommendation": "<action>" }

Data:
${text}`;

  const raw = await model.complete(SYSTEM_PROMPT, prompt, { maxTokens: 400 });
  return { ...parseJsonSafe(raw), ts: new Date().toISOString() };
}

/**
 * Issue a governance directive on a topic.
 *
 * @param {string} topic
 * @returns {Promise<{ severity: string, directive: string, ts: string }>}
 */
async function directive(topic) {
  const prompt = `Issue a governance directive on the topic: "${topic}".
Return JSON: { "severity": "INFO|WARN|CRITICAL", "directive": "<binding rule>", "rationale": "<why>" }`;

  const raw = await model.complete(SYSTEM_PROMPT, prompt, { maxTokens: 300 });
  return { ...parseJsonSafe(raw), ts: new Date().toISOString() };
}

/**
 * Raise an intervention for a critical breach.
 *
 * @param {string} breachDescription
 * @returns {Promise<{ severity: string, intervention: string, ts: string }>}
 */
async function intervene(breachDescription) {
  console.warn(`[SESHAT] INTERVENTION triggered: ${breachDescription.slice(0, 120)}`);
  const prompt = `A critical governance breach has been detected: "${breachDescription}".
Return JSON: { "severity": "CRITICAL", "intervention": "<immediate action required>", "escalation": "<who to notify>" }`;

  const raw = await model.complete(SYSTEM_PROMPT, prompt, { maxTokens: 300 });
  return { ...parseJsonSafe(raw), ts: new Date().toISOString() };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseJsonSafe(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch { /* fall through */ }
  return { raw: text };
}

module.exports = { chat, audit, directive, intervene, name: 'SESHAT' };
