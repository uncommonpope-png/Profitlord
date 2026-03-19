'use strict';

// ---------------------------------------------------------------------------
// messaging.js — Profitlord proactive message engine
//
// Decides when to send messages and what they contain.
// All outbound delivery goes through telegram.sendMessage().
//
// Triggers:
//   triggerError(context, error)          — server error / state failure
//   triggerTaskComplete(task, source)     — task executed successfully
//   triggerSeshatDirective(directive)     — SESHAT governance directive issued
//   triggerDrift(detail)                  — system drift / health degradation
//   triggerOpportunity(description, soul) — high-value opportunity detected
//
// Heartbeat:
//   startHeartbeat()  — call once on server startup
//   sendHeartbeat()   — send immediately (also called by interval)
//
// Env vars:
//   BOT_TOKEN                — Telegram bot token
//   CHAT_ID                  — Telegram chat ID
//   HEARTBEAT_INTERVAL_MINS  — heartbeat cadence in minutes (default: 30)
// ---------------------------------------------------------------------------

const { sendMessage } = require('./telegram');

const HEARTBEAT_INTERVAL_MINS = parseInt(process.env.HEARTBEAT_INTERVAL_MINS || '30', 10);
const HEARTBEAT_MS             = HEARTBEAT_INTERVAL_MINS * 60 * 1000;

// ─── In-memory system state snapshot ────────────────────────────────────────
// Updated by server/index.js via updateLocalState() so heartbeats reflect
// real current state without an extra GitHub API call.

let _state = {
  health:       100,
  current_task: 'idle',
  updated_at:   null,
};

function updateLocalState(patch) {
  Object.assign(_state, patch);
}

// ─── Triggers ────────────────────────────────────────────────────────────────

async function triggerError(context, error) {
  const text = [
    '🔴 <b>PROFITLORD — SYSTEM ERROR</b>',
    '',
    `<b>Context:</b> ${esc(context)}`,
    `<b>Error:</b> ${esc(String(error))}`,
    `<b>Time:</b> ${new Date().toISOString()}`,
  ].join('\n');
  return sendMessage(text);
}

async function triggerTaskComplete(task, source) {
  const text = [
    '✅ <b>TASK COMPLETE</b>',
    '',
    `<b>Task:</b> ${esc(task)}`,
    `<b>Source:</b> ${esc(source)}`,
    `<b>Health:</b> ${_state.health}%`,
    `<b>Time:</b> ${new Date().toISOString()}`,
  ].join('\n');
  return sendMessage(text);
}

async function triggerSeshatDirective(directive) {
  const lines = ['🏛 <b>[SESHAT DIRECTIVE]</b>', ''];
  if (directive.priority)     lines.push(`<b>Priority:</b> ${esc(directive.priority)}`);
  if (directive.assigned_to)  lines.push(`<b>Assigned To:</b> ${esc(directive.assigned_to)}`);
  if (directive.reason)       lines.push(`<b>Reason:</b> ${esc(directive.reason)}`);
  if (directive.action)       lines.push(`<b>Action:</b> ${esc(directive.action)}`);
  if (directive.verification) lines.push(`<b>Verification:</b> ${esc(directive.verification)}`);
  if (directive.phase)        lines.push(`<b>Phase:</b> ${esc(directive.phase)}`);
  if (directive.risk)         lines.push(`<b>Risk:</b> ${esc(directive.risk)}`);
  lines.push('', `<i>${new Date().toISOString()}</i>`);
  return sendMessage(lines.join('\n'));
}

async function triggerDrift(detail) {
  const text = [
    '⚠️ <b>DRIFT DETECTED</b>',
    '',
    `<b>Detail:</b> ${esc(detail)}`,
    `<b>Health:</b> ${_state.health}%`,
    `<b>Task:</b> ${esc(_state.current_task || 'idle')}`,
    `<b>Time:</b> ${new Date().toISOString()}`,
  ].join('\n');
  return sendMessage(text);
}

async function triggerOpportunity(description, soul) {
  const text = [
    '💰 <b>HIGH-VALUE OPPORTUNITY</b>',
    '',
    `<b>Description:</b> ${esc(description)}`,
    `<b>Detected by:</b> ${esc(soul || 'system')}`,
    `<b>Time:</b> ${new Date().toISOString()}`,
  ].join('\n');
  return sendMessage(text);
}

// ─── Heartbeat ───────────────────────────────────────────────────────────────

async function sendHeartbeat() {
  const text = [
    '💓 <b>PROFITLORD HEARTBEAT</b>',
    '',
    `<b>Health:</b> ${_state.health ?? 100}%`,
    `<b>Task:</b> ${esc(_state.current_task || 'idle')}`,
    `<b>Updated:</b> ${_state.updated_at || '—'}`,
    `<b>Time:</b> ${new Date().toISOString()}`,
  ].join('\n');
  return sendMessage(text);
}

function startHeartbeat() {
  if (!process.env.BOT_TOKEN || !process.env.CHAT_ID) {
    console.log('[messaging] heartbeat disabled — BOT_TOKEN or CHAT_ID not set');
    return null;
  }
  console.log(`[messaging] heartbeat enabled — every ${HEARTBEAT_INTERVAL_MINS}m`);

  // Send first heartbeat 60s after boot so the server is fully up
  const boot = setTimeout(sendHeartbeat, 60_000);
  boot.unref();

  const timer = setInterval(sendHeartbeat, HEARTBEAT_MS);
  timer.unref(); // never block process exit
  return timer;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(str) {
  // Minimal HTML escaping for Telegram HTML parse_mode
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = {
  updateLocalState,
  triggerError,
  triggerTaskComplete,
  triggerSeshatDirective,
  triggerDrift,
  triggerOpportunity,
  sendHeartbeat,
  startHeartbeat,
};
