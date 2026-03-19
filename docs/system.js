'use strict';

// ---------------------------------------------------------------------------
// docs/system.js — SESHAT Routing Tier Definition
//
// Defines the routing authority hierarchy and task-routing logic for the
// Profitlord multi-agent system.  SESHAT PRIME sits at Tier 1 and all other
// souls are subordinate.
//
// This module is loaded by the dashboard and any client-side tooling that
// needs to understand system topology.
// ---------------------------------------------------------------------------

const SYSTEM = {
  name: 'Profitlord',
  version: '2.0.0',

  // ── Routing Tiers ──────────────────────────────────────────────────────────
  tiers: [
    {
      level: 1,
      name: 'SUPREME GOVERNANCE',
      description: 'SESHAT PRIME — supreme routing and governance authority. All directives from this tier override all lower tiers.',
      souls: ['SESHAT PRIME'],
    },
    {
      level: 2,
      name: 'ORCHESTRATION',
      description: 'SoulCollector — receives tasks from Tier 1 and delegates to specialist souls.',
      souls: ['SoulCollector'],
    },
    {
      level: 3,
      name: 'SPECIALIST EXECUTION',
      description: 'Domain-expert agents. Tasks are routed here by SoulCollector based on capability match.',
      souls: ['Profit', 'Deerg', 'Betty', 'Teacher', 'Architect', 'Builder', 'Auditor', 'Scout', 'Scribe'],
    },
  ],

  // ── Routing Rules ──────────────────────────────────────────────────────────
  routing: [
    { keywords: ['profit', 'revenue', 'PLT', 'pricing', 'strategy'],      soul: 'Profit' },
    { keywords: ['deal', 'negotiation', 'pipeline', 'risk'],              soul: 'Deerg' },
    { keywords: ['cashflow', 'budget', 'operations', 'KPI'],              soul: 'Betty' },
    { keywords: ['learn', 'framework', 'playbook', 'explain', 'teach'],   soul: 'Teacher' },
    { keywords: ['architecture', 'design', 'system', 'infrastructure'],   soul: 'Architect' },
    { keywords: ['code', 'build', 'deploy', 'automation', 'CI'],          soul: 'Builder' },
    { keywords: ['audit', 'review', 'compliance', 'quality', 'security'], soul: 'Auditor' },
    { keywords: ['market', 'research', 'competitive', 'trend', 'leads'],  soul: 'Scout' },
    { keywords: ['document', 'report', 'log', 'summary', 'chronicle'],    soul: 'Scribe' },
  ],

  // ── Governance ─────────────────────────────────────────────────────────────
  governance: {
    authority:        'SESHAT PRIME',
    heartbeat_mins:   30,
    drift_threshold:  80,   // health below this triggers intervention
    idle_timeout_mins: 30,  // soul idle longer than this triggers re-activation directive
  },
};

/**
 * routeTask(taskText)
 *
 * Returns the best-matching soul name for a given task string,
 * based on keyword matching in SYSTEM.routing.
 * Falls back to 'SoulCollector' if no match found.
 *
 * @param {string} taskText
 * @returns {string} soul name
 */
function routeTask(taskText) {
  const lower = taskText.toLowerCase();
  for (const rule of SYSTEM.routing) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule.soul;
    }
  }
  return 'SoulCollector';
}

/**
 * getTier(soulName)
 *
 * Returns the tier level (1-3) for a given soul name, or null if not found.
 *
 * @param {string} soulName
 * @returns {number|null}
 */
function getTier(soulName) {
  for (const tier of SYSTEM.tiers) {
    if (tier.souls.includes(soulName)) return tier.level;
  }
  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SYSTEM, routeTask, getTier };
} else {
  // Browser global
  window.PLT_SYSTEM = { SYSTEM, routeTask, getTier };
}
