/**
 * Run schema on startup if tables are missing.
 * Schema is embedded to work with tsup bundled output.
 * @module db/migrate
 */

import { getDb } from './connection.js';

interface MinimalLogger {
  info(msg: string): void;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  repo          TEXT NOT NULL,
  path          TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  ao_config_json TEXT,
  total_cost_usd REAL NOT NULL DEFAULT 0.0,
  task_count    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  brief         TEXT,
  raw_input     TEXT NOT NULL,
  project_id    TEXT REFERENCES projects(id),
  state         TEXT NOT NULL DEFAULT 'draft'
                CHECK(state IN ('draft','refined','pending_approval',
                                'approved','auditing','decomposing',
                                'dispatched','running',
                                'sleeping','done','failed')),
  priority      INTEGER NOT NULL DEFAULT 0,
  ao_session_id TEXT,
  ao_branch     TEXT,
  ao_pr_url     TEXT,
  failure_reason TEXT,
  cost_usd      REAL NOT NULL DEFAULT 0.0,
  token_input   INTEGER NOT NULL DEFAULT 0,
  token_output  INTEGER NOT NULL DEFAULT 0,
  parent_task_id TEXT REFERENCES tasks(id),
  metadata      TEXT DEFAULT '{}',
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  approved_at   INTEGER,
  dispatched_at INTEGER,
  completed_at  INTEGER,
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS events (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES tasks(id),
  event_type    TEXT NOT NULL
                CHECK(event_type IN ('created','state_changed','brief_refined',
                                     'signed_off','dispatched','ao_update',
                                     'pr_opened','ci_passed','ci_failed',
                                     'done','failed','cost_update',
                                     'comment','retried','slept','woke')),
  from_state    TEXT,
  to_state      TEXT,
  payload       TEXT DEFAULT '{}',
  actor         TEXT DEFAULT 'system',
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS comments (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES tasks(id),
  author        TEXT NOT NULL,
  body          TEXT NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id, created_at);

CREATE TABLE IF NOT EXISTS task_sessions (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL REFERENCES tasks(id),
  session_number  INTEGER NOT NULL,
  title           TEXT NOT NULL,
  prompt          TEXT NOT NULL DEFAULT '',
  deliverables    TEXT NOT NULL DEFAULT '[]',
  verification    TEXT NOT NULL DEFAULT '[]',
  regression      TEXT NOT NULL DEFAULT '[]',
  anti_patterns   TEXT NOT NULL DEFAULT '[]',
  state           TEXT NOT NULL DEFAULT 'pending'
                  CHECK(state IN ('pending','auditing','ready','dispatched',
                                  'running','verifying','passed','failed','skipped')),
  ao_session_id   TEXT,
  audit_report    TEXT,
  verification_output TEXT,
  failure_reason  TEXT,
  cost_usd        REAL NOT NULL DEFAULT 0.0,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  started_at      INTEGER,
  completed_at    INTEGER
);

CREATE TABLE IF NOT EXISTS audit_verdicts (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL REFERENCES tasks(id),
  file_path       TEXT NOT NULL,
  verdict         TEXT NOT NULL CHECK(verdict IN ('keep','patch','rewrite','delete','create')),
  reason          TEXT NOT NULL,
  patch_details   TEXT,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_task ON task_sessions(task_id, session_number);
CREATE INDEX IF NOT EXISTS idx_sessions_state ON task_sessions(state);
CREATE INDEX IF NOT EXISTS idx_audits_task ON audit_verdicts(task_id);
`;

/**
 * Apply schema to the database.
 * Safe to call repeatedly — uses IF NOT EXISTS.
 * @param logger - Logger with info method
 * @returns void
 */
export function migrate(logger: MinimalLogger): void {
  const db = getDb();
  const existing = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'"
  ).get() as { name: string } | undefined;

  if (!existing) {
    logger.info('Running database migration...');
    db.exec(SCHEMA);
    logger.info('Database migration complete — tables: projects, tasks, events, comments');

    // Seed ops-homelab on first boot
    db.prepare(`
      INSERT OR IGNORE INTO projects (id, name, repo, path, default_branch)
      VALUES (?, ?, ?, ?, ?)
    `).run('prj_ops_homelab', 'Homelab Ops', 'phj6688/homelab-ops', '/root/repos/homelab-ops', 'main');
    logger.info('Seeded default project: ops-homelab');
  } else {
    logger.info('Database tables already exist — skipping migration');
  }

  // Always ensure cortex-v3 project exists
  db.prepare(`
    INSERT OR IGNORE INTO projects (id, name, repo, path, default_branch)
    VALUES (?, ?, ?, ?, ?)
  `).run('prj_cortex_v3', 'Cortex V3', 'phj6688/cortex', '/root/repos/cortex-v3', 'master');
}
