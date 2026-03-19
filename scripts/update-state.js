#!/usr/bin/env node
'use strict';

/**
 * update-state.js
 * ---------------
 * Runs after deploy-seo.js.  Updates docs/state.json (health, souls, current
 * task, timestamps) and appends an event line to docs/ledger.jsonl.
 *
 * Usage:
 *   node scripts/update-state.js
 *
 * Env vars honoured:
 *   OUTPUT_DIR  – where docs/ lives (default: <repo>/docs)
 *   SITE_URL    – canonical site root
 *   HEALTH      – override health score (0-100)
 */

const fs   = require('fs');
const path = require('path');

const outputDir = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.resolve(__dirname, '..', 'docs');

const siteUrl = process.env.SITE_URL || 'https://uncommonpope-png.github.io/Profitlord';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  console.log(`  Written: ${filePath}`);
}

function appendJsonl(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(obj) + '\n', 'utf8');
  console.log(`  Appended: ${filePath}`);
}

function countFiles(dir, ext) {
  let count = 0;
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(d, entry.name));
      else if (entry.name.endsWith(ext)) count++;
    }
  }
  walk(dir);
  return count;
}

// ---------------------------------------------------------------------------
// Load agents registry
// ---------------------------------------------------------------------------

function loadAgents(agentsPath) {
  const agents = readJson(agentsPath, []);
  const now = new Date().toISOString();

  // Mark souls stale / offline if last_seen is >1 hour old
  const STALE_MS = 60 * 60 * 1000;
  return agents.map((a) => {
    const soul = { ...a };
    if (soul.last_seen) {
      const age = Date.now() - new Date(soul.last_seen).getTime();
      if (age > STALE_MS * 24) {
        soul.status = 'offline';
      } else if (age > STALE_MS) {
        soul.status = 'stale';
      }
    }
    // nreal itself marks souls as "active" when the build runs
    if (soul.id === 'profit' || soul.id === 'deerg') {
      soul.status = 'active';
      soul.last_seen = now;
    }
    return soul;
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const statePath   = path.join(outputDir, 'state.json');
  const ledgerPath  = path.join(outputDir, 'ledger.jsonl');
  const agentsPath  = path.join(outputDir, 'agents.json');

  const now       = new Date().toISOString();
  const htmlFiles = countFiles(outputDir, '.html');
  const health    = process.env.HEALTH ? parseInt(process.env.HEALTH, 10) : 100;

  const souls = loadAgents(agentsPath);

  // Merge with existing state so we don't overwrite unrelated fields
  const existing = readJson(statePath, {});

  const state = {
    ...existing,
    updated_at:   now,
    health:       health,
    current_task: 'idle',
    site_url:     siteUrl,
    pages_total:  htmlFiles,
    souls:        souls,
  };

  writeJson(statePath, state);

  // Build ledger event
  const event = {
    ts:      now,
    type:    'nreal.build',
    summary: `Build complete. ${htmlFiles} HTML files in docs/`,
    details: {
      pages_scanned: htmlFiles,
      health:        health,
      souls_active:  souls.filter((s) => s.status === 'active').length,
    },
  };

  appendJsonl(ledgerPath, event);

  console.log('');
  console.log('✅ State + ledger updated.');
  console.log(`   Health     : ${health}`);
  console.log(`   Pages      : ${htmlFiles}`);
  console.log(`   Souls      : ${souls.length}`);
  console.log(`   State file : ${statePath}`);
  console.log(`   Ledger file: ${ledgerPath}`);
}

main();
