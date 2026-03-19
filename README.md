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

| Method | Path | Body / Params | Description |
|--------|------|--------------|-------------|
| GET | `/health` | — | Health check |
| GET | `/auth/login` | — | Redirect to GitHub OAuth authorization |
| GET | `/auth/callback` | `?code=&state=` | Exchange OAuth code for session token; redirects to dashboard |
| GET | `/auth/me` | — | Return authenticated user info (requires `Authorization: Bearer <token>`) |
| GET | `/auth/logout` | — | Invalidate the current session (requires `Authorization: Bearer <token>`) |
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
| `GH_CLIENT_ID` | GitHub OAuth App client ID (required for `/auth/*` endpoints) |
| `GH_CLIENT_SECRET` | GitHub OAuth App client secret (required for `/auth/*` endpoints) |
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
| `docs/agents.json` | Souls registry (11 souls including Seshat) |
| `docs/queue.jsonl` | Pending command queue (append-only JSONL) |
| `docs/queue-processed.jsonl` | Consumed commands archive |
| `docs/nreal.html` | nreal console UI (live state + ledger, served by GitHub Pages) |

## Souls Registry

Eleven souls are defined in `docs/agents.json`:

| Soul | Role | AI Backend |
|------|------|------------|
| **SoulCollector** | Soul Orchestrator | OpenClaw |
| **Profit** | Chief Profit Officer | OpenClaw |
| **Deerg** | Deal Evaluator | OpenClaw |
| **Betty** | Business Operations | OpenClaw |
| **Teacher** | Knowledge Synthesizer | OpenClaw |
| **Architect** | Systems Designer | OpenClaw |
| **Builder** | Execution Engine | OpenClaw |
| **Auditor** | Quality & Compliance | OpenClaw |
| **Scout** | Intelligence Gatherer | OpenClaw |
| **Scribe** | Chronicler & Documenter | OpenClaw |
| **Seshat** | Knowledge Keeper | OpenClaw |

Each soul has: `id`, `name`, `capabilities`, `status`, `last_seen`, `endpoint`.

> **Seshat** is the Egyptian goddess of writing and wisdom. She maintains the living knowledge base, synthesises patterns from all soul activity, and surfaces actionable insights from the ledger. She is the primary soul connected to OpenClaw.

## OpenClaw AI Brain (Cloud)

All soul chat endpoints (`POST /chat/:soul`) are backed by **OpenClaw** — an open-source, self-hosted LLM gateway with an OpenAI-compatible REST API. This lets Seshat (and every other soul) run real AI conversations in the cloud.

### How it works

```
Dashboard → POST /chat/Seshat → Render server → OpenClaw /v1/chat/completions → LLM reply
```

- Each soul gets a unique **system prompt** defining its personality and focus area.
- The request carries `x-openclaw-agent-id: seshat` so OpenClaw can route to the right agent config.
- If OpenClaw is unreachable or not configured, the server falls back to a descriptive stub reply — no errors surface to the user.

### Deploy your own OpenClaw instance

OpenClaw runs on any Node.js host. The free tier on Render works:

```bash
npm install -g openclaw
openclaw onboard --install-daemon
```

Or deploy via the [OpenClaw GitHub repo](https://github.com/openclaw/openclaw) / Docker image to Render, Railway, Fly.io, etc.

### Connect to Profitlord

Set two environment variables on your **Render `plt-server` service**:

| Variable | Value |
|----------|-------|
| `OPENCLAW_URL` | Your OpenClaw gateway URL, e.g. `https://my-openclaw.onrender.com` |
| `OPENCLAW_TOKEN` | The bearer token / password set in your OpenClaw instance |

The server will log `OpenClaw AI brain: enabled (https://...)` on startup when configured correctly.

## Enqueue a Command Locally

```bash
# Syntax: node scripts/enqueue-command.js <TYPE> [json-payload]
node scripts/enqueue-command.js BUILD:book '{"title":"My New Book"}'
node scripts/enqueue-command.js SCAN
node scripts/enqueue-command.js PING
```

The next workflow run will pick up and process the queued command.

## Environment Variables

### Build / static site

| Variable | Default | Usage |
|----------|---------|-------|
| `SITE_URL` | `https://uncommonpope-png.github.io/Profitlord` | Canonical site root |
| `OUTPUT_DIR` | `docs` | Output directory for generated files |
| `SITE_NAME` | `Profitlord` | Site name used in HTML |
| `SITE_DESCRIPTION` | (see deploy-seo.js) | Meta description |

### Render server (`server/index.js`)

| Variable | Required | Usage |
|----------|----------|-------|
| `GH_TOKEN` | Yes | GitHub PAT with repo write access |
| `GH_OWNER` | Yes | Repository owner |
| `GH_REPO` | Yes | Repository name |
| `GH_BRANCH` | No | Branch to commit state to (default: `main`) |
| `GH_CLIENT_ID` | No | GitHub OAuth App client ID |
| `GH_CLIENT_SECRET` | No | GitHub OAuth App client secret |
| `REDIS_URL` | No | Redis connection URL for caching |
| `OPENCLAW_URL` | No | OpenClaw gateway base URL (enables AI brain) |
| `OPENCLAW_TOKEN` | No | Bearer token for OpenClaw gateway |
| `PORT` | No | Listening port (default: 3000) |

## Live Links

- **GitHub Repository**: <https://github.com/uncommonpope-png/Profitlord>
- **Site**: <https://uncommonpope-png.github.io/Profitlord/>
- **nreal console**: <https://uncommonpope-png.github.io/Profitlord/nreal.html>
- **State JSON**: <https://uncommonpope-png.github.io/Profitlord/state.json>
- **Ledger**: <https://uncommonpope-png.github.io/Profitlord/ledger.jsonl>
