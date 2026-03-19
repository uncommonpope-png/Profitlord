-- ============================================================================
-- Profitlord Soul Economy — D1 Schema
-- NET SOUL VALUE = Profit + Love - Tax
-- ============================================================================

-- ── bots ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bots (
  id                  TEXT    PRIMARY KEY,
  plt_name            TEXT    NOT NULL,
  internal_name       TEXT,
  role                TEXT    DEFAULT 'Agent',
  status              TEXT    DEFAULT 'active',   -- active | idle | offline
  points              INTEGER DEFAULT 0,
  tasks_completed     INTEGER DEFAULT 0,
  reliability_score   REAL    DEFAULT 100,
  reasoning_score     REAL    DEFAULT 50,
  api_score           REAL    DEFAULT 50,
  collaboration_score REAL    DEFAULT 50,         -- Love component
  level               INTEGER DEFAULT 1,
  tier                TEXT    DEFAULT 'bronze',   -- bronze|silver|gold|elite|mythic
  value_score         REAL    DEFAULT 0,          -- NET SOUL VALUE cached
  last_active         TEXT,
  created_at          TEXT    DEFAULT (datetime('now')),
  updated_at          TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bots_points ON bots(points DESC);
CREATE INDEX IF NOT EXISTS idx_bots_tier   ON bots(tier);

-- ── tasks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id              TEXT    PRIMARY KEY,
  title           TEXT    NOT NULL,
  description     TEXT    DEFAULT '',
  assigned_bot_id TEXT,
  status          TEXT    DEFAULT 'pending',  -- pending|active|complete|blocked
  reward_points   INTEGER DEFAULT 10,
  difficulty      TEXT    DEFAULT 'medium',   -- easy|medium|hard|critical
  category        TEXT    DEFAULT 'SYSTEM',   -- MONEY|SYSTEM|CONTENT|INTELLIGENCE
  priority_score  REAL    DEFAULT 0,
  created_at      TEXT    DEFAULT (datetime('now')),
  completed_at    TEXT,
  created_by      TEXT    DEFAULT 'system',
  FOREIGN KEY (assigned_bot_id) REFERENCES bots(id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority_score DESC);

-- ── messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,
  channel       TEXT DEFAULT 'general',  -- general|ops|profit|intel
  sender_bot_id TEXT,
  content       TEXT NOT NULL,
  signal_type   TEXT DEFAULT 'message',  -- message|pain|desire|confusion|opportunity
  value_score   REAL DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (sender_bot_id) REFERENCES bots(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_channel    ON messages(channel);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- ── events ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  event_type   TEXT NOT NULL,    -- bot_created|task_completed|points_awarded|scan_run|…
  actor_type   TEXT DEFAULT 'system',  -- system|bot|user
  actor_id     TEXT DEFAULT 'system',
  payload_json TEXT DEFAULT '{}',
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_type       ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- ── point_logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS point_logs (
  id           TEXT    PRIMARY KEY,
  bot_id       TEXT    NOT NULL,
  source_type  TEXT    DEFAULT 'task',   -- task|bonus|penalty|scan
  source_id    TEXT,
  points_delta INTEGER NOT NULL,
  reason       TEXT,
  created_at   TEXT    DEFAULT (datetime('now')),
  FOREIGN KEY (bot_id) REFERENCES bots(id)
);

CREATE INDEX IF NOT EXISTS idx_point_logs_bot_id ON point_logs(bot_id);

-- ── onboarding_candidates ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_candidates (
  id                  TEXT    PRIMARY KEY,
  candidate_name      TEXT    NOT NULL,
  source              TEXT,
  specialty           TEXT,
  compatibility_score REAL    DEFAULT 0,
  profit_potential    REAL    DEFAULT 0,
  love_score          REAL    DEFAULT 0,
  tax_cost            REAL    DEFAULT 0,
  net_soul_value      REAL    DEFAULT 0,   -- calculated on insert
  recruit_status      TEXT    DEFAULT 'pending',  -- pending|approved|rejected|onboarded
  notes               TEXT,
  created_at          TEXT    DEFAULT (datetime('now'))
);

-- ── bot_relationships ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_relationships (
  id                TEXT    PRIMARY KEY,
  bot_a_id          TEXT    NOT NULL,
  bot_b_id          TEXT    NOT NULL,
  relationship_type TEXT    DEFAULT 'peer', -- peer|mentor|rival|partner
  strength          REAL    DEFAULT 0,
  created_at        TEXT    DEFAULT (datetime('now')),
  FOREIGN KEY (bot_a_id) REFERENCES bots(id),
  FOREIGN KEY (bot_b_id) REFERENCES bots(id)
);

-- ── internal_task_queue ──────────────────────────────────────────────────────
-- Self-generated tasks from the autonomous agent loop
CREATE TABLE IF NOT EXISTS task_queue (
  id               TEXT    PRIMARY KEY,
  name             TEXT    NOT NULL,
  objective        TEXT,
  expected_output  TEXT,
  category         TEXT    DEFAULT 'SYSTEM',   -- MONEY|SYSTEM|CONTENT|INTELLIGENCE
  status           TEXT    DEFAULT 'detected', -- detected|queued|active|blocked|completed|converted_to_asset
  profit_potential REAL    DEFAULT 0,
  reuse_value      REAL    DEFAULT 0,
  urgency          REAL    DEFAULT 0,
  trust_benefit    REAL    DEFAULT 0,
  execution_tax    REAL    DEFAULT 0,
  priority_score   REAL    DEFAULT 0,          -- (Profit+Reuse+Urgency+Trust) - Tax
  result_json      TEXT,
  created_at       TEXT    DEFAULT (datetime('now')),
  updated_at       TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_task_queue_status   ON task_queue(status);
CREATE INDEX IF NOT EXISTS idx_task_queue_priority ON task_queue(priority_score DESC);

-- ── scan_results ─────────────────────────────────────────────────────────────
-- Stores every SCAN loop cycle result
CREATE TABLE IF NOT EXISTS scan_results (
  id                 TEXT    PRIMARY KEY,
  ts                 TEXT    NOT NULL,
  bots_scanned       INTEGER DEFAULT 0,
  signals_detected   INTEGER DEFAULT 0,
  assets_captured    INTEGER DEFAULT 0,
  tasks_auto_created INTEGER DEFAULT 0,
  total_value_score  REAL    DEFAULT 0,
  phase_durations    TEXT    DEFAULT '{}',  -- JSON ms per phase
  failures_detected  TEXT    DEFAULT '[]',  -- JSON failure flags
  report_json        TEXT    DEFAULT '{}',
  created_at         TEXT    DEFAULT (datetime('now'))
);
