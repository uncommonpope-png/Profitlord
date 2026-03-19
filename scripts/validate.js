#!/usr/bin/env node
'use strict';

/**
 * validate.js
 * -----------
 * Self-check validation script run by the nreal workflow after generation.
 *
 * Fails (exit 1) if any required file is missing or malformed.
 * On failure, records an error event in ledger.jsonl and sets health low in
 * state.json before exiting.
 *
 * Env vars:
 *   OUTPUT_DIR  – where docs/ lives (default: <repo>/docs)
 *   SITE_URL    – canonical site root (used to validate sitemap)
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

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw); // throws if invalid
}

function appendJsonl(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(obj) + '\n', 'utf8');
}

function setHealthLow(statePath, errors) {
  try {
    let state = {};
    try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch (_) {}
    state.health      = 0;
    state.updated_at  = new Date().toISOString();
    state.last_errors = errors;
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  } catch (_) {
    // Best-effort; don't mask original errors
  }
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const checks = [
  {
    name: 'docs/index.html exists',
    run() {
      const p = path.join(outputDir, 'index.html');
      if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}`);
    },
  },
  {
    name: 'docs/sitemap.xml exists and contains SITE_URL',
    run() {
      const p = path.join(outputDir, 'sitemap.xml');
      if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}`);
      const content = fs.readFileSync(p, 'utf8');
      // Check that at least one <loc> element contains the exact SITE_URL as a prefix
      const locStart = '<loc>' + siteUrl;
      if (!content.split('\n').some((line) => line.trimStart().startsWith(locStart))) {
        throw new Error(`sitemap.xml does not contain any <loc> starting with SITE_URL (${siteUrl})`);
      }
    },
  },
  {
    name: 'docs/state.json exists and is valid JSON',
    run() {
      const p = path.join(outputDir, 'state.json');
      if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}`);
      readJson(p); // throws if invalid JSON
    },
  },
  {
    name: 'docs/state.json contains updated_at',
    run() {
      const p = path.join(outputDir, 'state.json');
      const state = readJson(p);
      if (!state.updated_at) throw new Error('state.json is missing updated_at field');
    },
  },
  {
    name: 'docs/agents.json exists',
    run() {
      const p = path.join(outputDir, 'agents.json');
      if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}`);
    },
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const ledgerPath = path.join(outputDir, 'ledger.jsonl');
  const statePath  = path.join(outputDir, 'state.json');

  console.log('=== nreal Validation ===');
  console.log(`Output dir: ${outputDir}`);
  console.log('');

  const errors = [];

  for (const check of checks) {
    try {
      check.run();
      console.log(`  ✅ ${check.name}`);
    } catch (err) {
      console.error(`  ❌ ${check.name}: ${err.message}`);
      errors.push({ check: check.name, error: err.message });
    }
  }

  console.log('');

  if (errors.length > 0) {
    const now = new Date().toISOString();
    console.error(`Validation FAILED: ${errors.length} error(s).`);

    // Record error event in ledger
    appendJsonl(ledgerPath, {
      ts:      now,
      type:    'nreal.validate.error',
      summary: `Validation failed: ${errors.length} error(s)`,
      details: { errors },
    });

    // Set health low in state.json
    setHealthLow(statePath, errors);

    process.exit(1);
  }

  console.log(`✅ All ${checks.length} validations passed.`);
}

main();
