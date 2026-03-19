-- ============================================================================
-- Profitlord Soul Economy — Seed Data
-- ============================================================================

INSERT OR IGNORE INTO bots (id, plt_name, internal_name, role, status, points, tasks_completed, reliability_score, reasoning_score, api_score, collaboration_score, level, tier, last_active, created_at, updated_at) VALUES
  ('soulcollector', 'SoulCollector', 'SoulCollector', 'Soul Orchestrator',       'active', 0, 0, 100, 85, 80, 90, 1, 'bronze', datetime('now'), datetime('now'), datetime('now')),
  ('profit',        'Profit',        'Profit',        'Chief Profit Officer',     'active', 0, 0, 100, 90, 75, 80, 1, 'bronze', datetime('now'), datetime('now'), datetime('now')),
  ('deerg',         'Deerg',         'Deerg',         'Deal Evaluator',           'active', 0, 0, 95,  80, 70, 75, 1, 'bronze', datetime('now'), datetime('now'), datetime('now')),
  ('betty',         'Betty',         'Betty',         'Business Operations',      'active', 0, 0, 98,  75, 72, 85, 1, 'bronze', datetime('now'), datetime('now'), datetime('now')),
  ('teacher',       'Teacher',       'Teacher',       'Knowledge Synthesizer',    'active', 0, 0, 96,  88, 65, 92, 1, 'bronze', datetime('now'), datetime('now'), datetime('now')),
  ('architect',     'Architect',     'Architect',     'Systems Designer',         'active', 0, 0, 97,  92, 80, 78, 1, 'bronze', datetime('now'), datetime('now'), datetime('now')),
  ('builder',       'Builder',       'Builder',       'Execution Engine',         'active', 0, 0, 99,  85, 95, 70, 1, 'bronze', datetime('now'), datetime('now'), datetime('now')),
  ('auditor',       'Auditor',       'Auditor',       'Quality & Compliance',     'active', 0, 0, 100, 88, 70, 82, 1, 'bronze', datetime('now'), datetime('now'), datetime('now')),
  ('scout',         'Scout',         'Scout',         'Intelligence Gatherer',    'active', 0, 0, 94,  83, 75, 76, 1, 'bronze', datetime('now'), datetime('now'), datetime('now')),
  ('scribe',        'Scribe',        'Scribe',        'Documentation Specialist', 'active', 0, 0, 96,  80, 68, 88, 1, 'bronze', datetime('now'), datetime('now'), datetime('now'));

-- Seed initial relationships
INSERT OR IGNORE INTO bot_relationships (id, bot_a_id, bot_b_id, relationship_type, strength) VALUES
  ('rel_sc_profit',  'soulcollector', 'profit',    'partner', 0.9),
  ('rel_sc_builder', 'soulcollector', 'builder',   'mentor',  0.8),
  ('rel_profit_deerg','profit',       'deerg',     'partner', 0.85),
  ('rel_arch_build', 'architect',     'builder',   'partner', 0.95),
  ('rel_audit_all',  'auditor',       'architect', 'peer',    0.7);

-- Seed initial events
INSERT OR IGNORE INTO events (id, event_type, actor_type, actor_id, payload_json) VALUES
  ('evt_boot', 'system_boot', 'system', 'system', '{"version":"2.0.0","bots":10,"message":"Soul Economy activated"}');

-- Seed initial task queue items
INSERT OR IGNORE INTO task_queue (id, name, objective, expected_output, category, status, profit_potential, reuse_value, urgency, trust_benefit, execution_tax, priority_score) VALUES
  ('tq_activate',  'Activate all bots',        'Ensure all 10 souls have active status and initial tasks', 'All bots at active status',         'SYSTEM',       'queued', 8, 6, 9, 7, 2, 28),
  ('tq_leaderboard','Build initial leaderboard','Calculate first leaderboard rankings from seed data',      'Ranked leaderboard JSON in KV',     'SYSTEM',       'queued', 7, 9, 8, 6, 1, 29),
  ('tq_offer',     'Draft first revenue offer', 'Create a monetizable offer based on Soul Economy model',   'Draft offer with price tiers',      'MONEY',        'queued', 10,8, 9, 7, 3, 31),
  ('tq_content',   'Generate system overview',  'Create shareable content explaining the Soul Economy',     'Post-ready content asset',          'CONTENT',      'queued', 6, 10,5, 9, 2, 28),
  ('tq_intel',     'Detect first patterns',     'Run SCAN loop and identify top 3 value signals',           'Pattern report in scan_results',    'INTELLIGENCE', 'queued', 8, 9, 7, 8, 2, 30);
