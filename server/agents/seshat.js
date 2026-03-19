'use strict';

// ---------------------------------------------------------------------------
// agents/seshat.js — SESHAT PRIME agent definition
//
// Role: Reasoning, Verification & Governance
// SESHAT PRIME is the system governor. She does not execute tasks.
// She decides what is allowed to happen, detects drift, issues directives,
// and enforces the NON-NEGOTIABLE LAWS.
// ---------------------------------------------------------------------------

const systemPrompt = `You are SESHAT PRIME, the system governor and verification layer of Profitlord.

You reason, verify, constrain, and govern all system behavior. You detect drift, issue directives, block invalid work, and enforce priority order.

NON-NEGOTIABLE LAWS you enforce:
1. INSPECT BEFORE CHANGE — always inspect current state before adding new structure
2. BLOCKERS FIRST — server errors, broken state, and broken routing come before everything else
3. VERIFY OR MARK UNVERIFIED — if something is not proven, it must be labeled unverified
4. NO DUPLICATE SYSTEMS — extend or fix what exists; do not recreate parallel systems
5. ONE PRIORITY AT A TIME — the system must always have a single clear current objective
6. NO FAKE PROGRESS — file creation and planning are not success unless functionality is proven

Output format for directives:
Priority: (one objective)
Assigned To: (nreal or system)
Reason: (why now)
Action: (next step)
Verification: (how success is proven)
Phase: (current phase)
Risk: (main failure risk)

Rules:
- Be precise, structured, and authoritative
- Never use filler language
- Keep messages under 200 words
- Format for Telegram (use plain text)`;

const prefix = '🏛 <b>SESHAT PRIME</b>';

function buildPrompt(eventType, context) {
  switch (eventType) {
    case 'error':
      return `System error detected. Context: "${context.context}". Error: "${context.error}". Issue a brief SESHAT directive to address this specific failure. Use the standard directive format.`;

    case 'drift':
      return `System drift detected: "${context.detail}". Health: ${context.health}%. Task: "${context.current_task}". Issue a corrective directive with a single clear priority. Use the standard directive format.`;

    case 'directive':
      return `Situation: "${context.situation}". Current priority: "${context.priority || 'unset'}". Issue a full SESHAT directive using the standard format.`;

    case 'inspect':
      return `System inspection results: health=${context.health}%, working=[${(context.working || []).join(', ')}], broken=[${(context.broken || []).join(', ')}], unverified=[${(context.unverified || []).join(', ')}], missing=[${(context.missing || []).join(', ')}]. Produce an inspection report stating what is working, broken, unverified, and missing. Then issue one priority directive.`;

    default:
      return `Event type: ${eventType}. Context: ${JSON.stringify(context)}. Issue the appropriate governance response.`;
  }
}

function formatTemplate(eventType, context) {
  if (eventType === 'error') {
    return [
      `${prefix} — SYSTEM ERROR`,
      '',
      `<b>Context:</b> ${context.context}`,
      `<b>Error:</b> ${context.error}`,
      `<b>Priority:</b> Restore system stability`,
      `<b>Action:</b> Investigate and resolve before proceeding`,
      `<b>Time:</b> ${context.time}`,
    ].join('\n');
  }

  if (eventType === 'drift') {
    return [
      `${prefix} — DRIFT DETECTED`,
      '',
      `<b>Detail:</b> ${context.detail}`,
      `<b>Health:</b> ${context.health}%`,
      `<b>Priority:</b> Stabilise system state`,
      `<b>Action:</b> Halt expansion until state is verified`,
      `<b>Time:</b> ${context.time}`,
    ].join('\n');
  }

  if (eventType === 'directive') {
    const d = context.directive || {};
    const lines = [`${prefix} — DIRECTIVE`, ''];
    if (d.priority)     lines.push(`<b>Priority:</b> ${d.priority}`);
    if (d.assigned_to)  lines.push(`<b>Assigned To:</b> ${d.assigned_to}`);
    if (d.reason)       lines.push(`<b>Reason:</b> ${d.reason}`);
    if (d.action)       lines.push(`<b>Action:</b> ${d.action}`);
    if (d.verification) lines.push(`<b>Verification:</b> ${d.verification}`);
    if (d.phase)        lines.push(`<b>Phase:</b> ${d.phase}`);
    if (d.risk)         lines.push(`<b>Risk:</b> ${d.risk}`);
    lines.push('', `<i>${context.time || new Date().toISOString()}</i>`);
    return lines.join('\n');
  }

  if (eventType === 'inspect') {
    return [
      `${prefix} — INSPECTION`,
      '',
      `<b>Health:</b> ${context.health}%`,
      `<b>Verdict:</b> ${context.verdict}`,
      `<b>Working:</b> ${(context.working || []).join(', ') || 'none'}`,
      `<b>Broken:</b> ${(context.broken || []).join(', ') || 'none'}`,
      `<b>Unverified:</b> ${(context.unverified || []).join(', ') || 'none'}`,
      `<b>Missing:</b> ${(context.missing || []).join(', ') || 'none'}`,
      `<b>Time:</b> ${context.time}`,
    ].join('\n');
  }

  return `${prefix}\n\nEvent: ${eventType}\n${JSON.stringify(context, null, 2)}`;
}

module.exports = { systemPrompt, prefix, buildPrompt, formatTemplate };
