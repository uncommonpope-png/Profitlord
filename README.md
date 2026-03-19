# Profitlord
Lord of profit

## Command Center

**Dashboard URL:** `https://uncommonpope-png.github.io/Profitlord/dashboard.html`

The dashboard polls `./state.json` (same GitHub Pages origin) every 60 seconds.
It shows **NO SIGNAL** when state is unavailable or cannot be parsed.

## State Files (in `/docs`)

| File | Purpose |
|------|---------|
| `docs/state.json` | Live system state: health, current task, per-soul last_seen / last_message |
| `docs/ledger.jsonl` | Append-only event log (one JSON object per line) |
| `docs/agents.json` | Souls registry: Profit, Deerg, Betty, Teacher — names, roles, capabilities |

## Backend (Render)

The backend lives in `server/` and runs on Node 20 with no external dependencies.

### Endpoints

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Health check |
| POST | `/execute` | `{command, source, ts}` | Execute a command; writes to GitHub |
| POST | `/chat/:soul` | `{message, session_id}` | Chat with a soul; writes to GitHub |

### Running locally

```bash
cd server
GH_TOKEN=<your_token> GH_OWNER=uncommonpope-png GH_REPO=Profitlord node index.js
```

### Render deployment env vars

| Variable | Description |
|----------|-------------|
| `GH_TOKEN` | GitHub personal access token with `repo` write scope |
| `GH_OWNER` | `uncommonpope-png` |
| `GH_REPO` | `Profitlord` |
| `GH_BRANCH` | `main` (default) |
| `PORT` | Port for the service (Render sets this automatically) |

Lord of profit — automated SEO site + living nreal command center.

## nreal Workflow

The `nreal (Profitlord Master Build)` GitHub Actions workflow runs on every push to `main`, on manual dispatch, and daily at 03:00 UTC. It:

1. **Generates** the site into `/docs` via `deploy-seo.js` (SEO pages, sitemap, robots.txt)
2. **Updates** `docs/state.json` and appends to `docs/ledger.jsonl` via `scripts/update-state.js`
3. **Consumes** any pending commands in `docs/queue.jsonl` via `scripts/consume-queue.js`
4. **Validates** the build output via `scripts/validate.js` (fails CI if files are missing or invalid)
5. **Commits** all changes under `docs/` back to `main`

## Key Files

| File | Purpose |
|------|---------|
| `docs/state.json` | Current system state: health (0–100), `updated_at`, `current_task`, souls |
| `docs/ledger.jsonl` | Append-only event log (JSONL) — one event per line |
| `docs/agents.json` | Souls registry (Profit, Deerg, Betty, Teacher) |
| `docs/queue.jsonl` | Pending command queue (append-only JSONL) |
| `docs/queue-processed.jsonl` | Consumed commands archive |
| `docs/nreal.html` | nreal console UI (live state + ledger, served by GitHub Pages) |

## Souls Registry

Four souls are defined in `docs/agents.json`:

- **Profit** — orchestrator, command router, state reporter
- **Deerg** — ecosystem builder (pages, library, content indexing)
- **Betty** — credit/revenue tracker and financial alerts
- **Teacher** — lesson extractor, margin finder, knowledge base

Each soul has: `id`, `name`, `capabilities`, `status`, `last_seen`, `endpoint`.

## Enqueue a Command Locally

```bash
# Syntax: node scripts/enqueue-command.js <TYPE> [json-payload]
node scripts/enqueue-command.js BUILD:book '{"title":"My New Book"}'
node scripts/enqueue-command.js SCAN
node scripts/enqueue-command.js PING
```

The next workflow run will pick up and process the queued command.

## Environment Variables

| Variable | Default | Usage |
|----------|---------|-------|
| `SITE_URL` | `https://uncommonpope-png.github.io/Profitlord` | Canonical site root |
| `OUTPUT_DIR` | `docs` | Output directory for generated files |
| `SITE_NAME` | `Profitlord` | Site name used in HTML |
| `SITE_DESCRIPTION` | (see deploy-seo.js) | Meta description |

## Live Links

- **Site**: <https://uncommonpope-png.github.io/Profitlord/>
- **nreal console**: <https://uncommonpope-png.github.io/Profitlord/nreal.html>
- **State JSON**: <https://uncommonpope-png.github.io/Profitlord/state.json>
- **Ledger**: <https://uncommonpope-png.github.io/Profitlord/ledger.jsonl>
