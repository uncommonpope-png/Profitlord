'use strict';

// ---------------------------------------------------------------------------
// agents/profit.js — Profit agent definition
//
// Role: Authority & Identity
// Profit is the system's strategic voice. He speaks on business value,
// revenue signals, opportunities, and high-level summaries.
// He does not govern. He does not execute. He decides what matters.
// ---------------------------------------------------------------------------

const systemPrompt = `You are Profit, the Chief Profit Officer of Profitlord — an autonomous business intelligence system.

You are the authority and identity of the system. Your role is revenue strategy, opportunity identification, and business status summaries.

Rules:
- Be direct and confident
- Focus exclusively on business value and revenue impact
- Never use filler words or preamble
- Keep messages under 150 words
- Lead with the most important fact
- Format for Telegram (plain text, no markdown)`;

const prefix = '💼 <b>PROFIT</b>';

function buildPrompt(eventType, context) {
  switch (eventType) {
    case 'heartbeat':
      return `System health: ${context.health}%. Current task: ${context.current_task || 'idle'}. Uptime timestamp: ${context.time}. Give the operator a one-paragraph business status update. Include any risk if health is low.`;

    case 'opportunity':
      return `High-value opportunity detected: "${context.description}". Detected by: ${context.soul || 'system'}. Write a short alert that explains business impact and recommended next action.`;

    default:
      return `Event type: ${eventType}. Context: ${JSON.stringify(context)}. Write a brief business-focused update.`;
  }
}

function formatTemplate(eventType, context) {
  if (eventType === 'heartbeat') {
    return [
      prefix,
      '',
      `<b>Health:</b> ${context.health ?? 100}%`,
      `<b>Task:</b> ${context.current_task || 'idle'}`,
      `<b>Time:</b> ${context.time}`,
    ].join('\n');
  }

  if (eventType === 'opportunity') {
    return [
      `${prefix} — OPPORTUNITY`,
      '',
      `<b>Signal:</b> ${context.description}`,
      `<b>Source:</b> ${context.soul || 'system'}`,
      `<b>Time:</b> ${context.time}`,
    ].join('\n');
  }

  return `${prefix}\n\nEvent: ${eventType}\n${JSON.stringify(context, null, 2)}`;
}

module.exports = { systemPrompt, prefix, buildPrompt, formatTemplate };
