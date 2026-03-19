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
