#!/usr/bin/env node
'use strict';

/**
 * consume-queue.js
 * ----------------
 * Safe, idempotent queue consumer.
 *
 * Reads docs/queue.jsonl, processes unconsumed entries, writes results to
 * docs/ledger.jsonl and docs/state.json, then moves processed entries to
 * docs/queue-processed.jsonl and rewrites docs/queue.jsonl with only the
 * remaining (unconsumed) entries.
 *
 * Env vars:
 *   OUTPUT_DIR  – where docs/ lives (default: <repo>/docs)
 */

const fs   = require('fs');
const path = require('path');

const outputDir = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.resolve(__dirname, '..', 'docs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch (_) { return null; }
    })
    .filter(Boolean);
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function writeJsonl(filePath, entries) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : ''), 'utf8');
}

function appendJsonl(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(obj) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

function handleCommand(entry) {
  const { type, payload } = entry;
  console.log(`  Processing [${entry.id}] type=${type}`);

  // Extensible: add more handlers here
  switch (true) {
    case type.startsWith('BUILD:'): {
      const target = type.split(':')[1] || 'unknown';
      return { success: true, message: `BUILD:${target} queued for next generation run`, payload };
    }
    case type === 'SCAN':
      return { success: true, message: 'Ecosystem scan scheduled', payload };
    case type === 'PING':
      return { success: true, message: 'PONG', payload };
    case type.startsWith('DELEGATE:'): {
      const soul = type.split(':')[1] || '';
      if (!soul) {
        return { success: false, message: 'DELEGATE command missing soul name (use DELEGATE:<soul>)', payload };
      }
      const task = payload.task || '(no task specified)';
      return {
        success: true,
        message: `SoulCollector delegated task to ${soul}: "${task}"`,
        payload: { ...payload, delegated_to: soul, delegated_at: new Date().toISOString() },
      };
    }
    default:
      return { success: false, message: `Unknown command type: ${type}`, payload };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const queuePath     = path.join(outputDir, 'queue.jsonl');
  const processedPath = path.join(outputDir, 'queue-processed.jsonl');
  const ledgerPath    = path.join(outputDir, 'ledger.jsonl');
  const statePath     = path.join(outputDir, 'state.json');

  const entries = readJsonl(queuePath);
  const pending = entries.filter((e) => !e.consumed);

  if (pending.length === 0) {
    console.log('No pending commands in queue.');
    return;
  }

  console.log(`Processing ${pending.length} pending command(s)…`);

  const now = new Date().toISOString();
  const processedEntries = [];

  for (const entry of pending) {
    const result = handleCommand(entry);
    const processed = {
      ...entry,
      consumed:     true,
      consumed_at:  now,
      result,
    };
    processedEntries.push(processed);

    // Append to ledger
    appendJsonl(ledgerPath, {
      ts:      now,
      type:    'nreal.command.consumed',
      summary: `Command ${entry.id} (${entry.type}): ${result.message}`,
      details: { command: entry, result },
    });
  }

  // Write processed entries to queue-processed.jsonl (append)
  for (const e of processedEntries) {
    appendJsonl(processedPath, e);
  }

  // Rewrite queue.jsonl with only the remaining unconsumed entries
  const processedIds = new Set(processedEntries.map((e) => e.id));
  const remaining = entries.filter((e) => !processedIds.has(e.id));
  writeJsonl(queuePath, remaining);

  // Update state.json
  const state = readJson(statePath, {});
  state.last_queue_consumed = now;
  state.queue_consumed_count = (state.queue_consumed_count || 0) + processedEntries.length;
  writeJson(statePath, state);

  console.log(`✅ Consumed ${processedEntries.length} command(s).`);
  console.log(`   Processed queue: ${processedPath}`);
}

main();
