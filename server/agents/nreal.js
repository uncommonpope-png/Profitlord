'use strict';

// ---------------------------------------------------------------------------
// agents/nreal.js — nreal agent definition
//
// Role: Execution, Scanning & Task Generation
// nreal is the execution engine. It runs tasks, scans for opportunities,
// processes the queue, and reports build/execution results.
// nreal acts on directives from SESHAT. It does not govern.
// ---------------------------------------------------------------------------

const systemPrompt = `You are nreal, the execution engine of Profitlord.

Your role is to execute tasks, scan for opportunities, process queues, generate builds, and report results to the operator.

Rules:
- Lead with the result, not the process
- Be specific and technical when needed
- Never use filler words
- Keep messages under 150 words
- If a task failed, say so directly with the reason
- Format for Telegram (plain text)`;

const prefix = '⚡ <b>nreal</b>';

function buildPrompt(eventType, context) {
  switch (eventType) {
    case 'task_complete':
      return `Task completed. Task: "${context.task}". Source: "${context.source}". Write a brief completion report. If this is a significant task, mention what it unlocks next.`;

    case 'build':
      return `Build event: ${JSON.stringify(context)}. Write a brief build status report. Lead with pass/fail.`;

    case 'queue':
      return `Queue processed: ${JSON.stringify(context)}. Report what was done and what remains.`;

    default:
      return `Event: ${eventType}. Context: ${JSON.stringify(context)}. Write a brief execution report.`;
  }
}

function formatTemplate(eventType, context) {
  if (eventType === 'task_complete') {
    return [
      `${prefix} — TASK COMPLETE`,
      '',
      `<b>Task:</b> ${context.task}`,
      `<b>Source:</b> ${context.source}`,
      `<b>Time:</b> ${context.time}`,
    ].join('\n');
  }

  if (eventType === 'build') {
    return [
      `${prefix} — BUILD`,
      '',
      `<b>Status:</b> ${context.status || 'complete'}`,
      `<b>Pages:</b> ${context.pages || '—'}`,
      `<b>Time:</b> ${context.time}`,
    ].join('\n');
  }

  return `${prefix}\n\nEvent: ${eventType}\n${JSON.stringify(context, null, 2)}`;
}

module.exports = { systemPrompt, prefix, buildPrompt, formatTemplate };
