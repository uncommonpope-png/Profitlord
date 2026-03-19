#!/usr/bin/env node
'use strict';

/**
 * enqueue-command.js
 * ------------------
 * Appends a command entry to docs/queue.jsonl.
 *
 * Usage:
 *   node scripts/enqueue-command.js <type> [payload-json]
 *
 * Examples:
 *   node scripts/enqueue-command.js BUILD:book '{"title":"My Book"}'
 *   node scripts/enqueue-command.js SCAN
 *
 * Env vars:
 *   OUTPUT_DIR  – where docs/ lives (default: <repo>/docs)
 */

const fs   = require('fs');
const path = require('path');

const outputDir = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.resolve(__dirname, '..', 'docs');

const [,, cmdType, payloadRaw] = process.argv;

if (!cmdType) {
  console.error('Usage: node scripts/enqueue-command.js <type> [payload-json]');
  process.exit(1);
}

let payload = {};
if (payloadRaw) {
  try {
    payload = JSON.parse(payloadRaw);
  } catch (e) {
    console.error('Invalid JSON payload:', e.message);
    process.exit(1);
  }
}

const entry = {
  id:        `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  ts:        new Date().toISOString(),
  type:      cmdType,
  payload:   payload,
  consumed:  false,
};

const queuePath = path.join(outputDir, 'queue.jsonl');
fs.mkdirSync(path.dirname(queuePath), { recursive: true });
fs.appendFileSync(queuePath, JSON.stringify(entry) + '\n', 'utf8');

console.log(`Enqueued command: ${entry.id} (${cmdType})`);
console.log(`Queue file: ${queuePath}`);
