# Orchestrator

The orchestrator scans repository state and **spawns Cursor Cloud Agents** for the next required role(s). It is the factory; [Cursor Automations](https://cursor.com/docs/cloud-agent/automations) or GitHub Actions are the clock.

## Architecture

```
┌─────────────────────┐
│  Trigger (pick one) │
├─────────────────────┤
│ GitHub Action cron  │──┐
│ Automation webhook  │  │
│ Manual CLI          │  │
└─────────────────────┘  │
                           ▼
              ┌────────────────────────┐
              │  orchestrate run     │
              │  1. sync registry    │
              │  2. plan work items  │
              │  3. POST /v1/agents  │
              └────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
      Scout            Researcher          Builder
         │                 │                 │
         └─────────────────┴─────────────────┘
                           │
                           ▼
              data/orchestrator/registry.json
              data/properties/{id}/*
              tasks/*
```

| Component | Responsibility |
|-----------|----------------|
| **Trigger** | When to run (schedule, webhook, manual) |
| **Orchestrator** | What agents to spawn from repo state |
| **Cloud Agents** | Execute role work (Scout, Researcher, etc.) |
| **registry.json** | Tracks active agent instances; prevents duplicates |

## Setup

### 1. API key

Create a [Cursor API key](https://cursor.com/dashboard/api) and store it as:

- **GitHub Actions**: repository secret `CURSOR_API_KEY`
- **Local / webhook**: environment variable `CURSOR_API_KEY`

### 2. Configuration

Edit `orchestrator.config.json` at the repo root:

| Field | Description |
|-------|-------------|
| `repoUrl` | GitHub repo URL |
| `startingRef` | Base branch (usually `main`) |
| `cloudEnvName` | Named Cursor cloud environment, or `null` to use inline `repos` |
| `modelId` | Cloud agent model (default: `auto` — Cursor Auto). Omit from config to use the same default. Other ids from `GET /v1/models` (e.g. `composer-2.5`). |
| `maxConcurrentAgents` | Global cap on simultaneous agents |
| `roles.*.maxConcurrent` | Per-role caps |
| `autoCreatePR` | Global default: open PR when agent completes |
| `roles.*.autoCreatePR` | Per-role override. Property roles (`manager`, `scout`, `analyst`, `auditor`) default to `false` — agents push directly to `startingRef`. `builder` keeps PRs. |
| `skipReviewerRequest` | Skip Cursor reviewer request on PR creation |
| `manager.scanCriteriaFile` | Path to scout search params (default: `data/search-criteria.json`) |

If you use a named cloud environment from the dashboard, set `cloudEnvName` and the orchestrator omits inline `repos` (the environment already defines them).

### 3. Install and verify

```bash
cd orchestrator
npm ci
npm run build
npm test
npm run plan -- --repo-root ..
```

Preview planned work without spawning agents:

```bash
export CURSOR_API_KEY=cursor_...
npm run plan -- --repo-root ..
npm run run -- --repo-root .. --dry-run
```

Spawn agents:

```bash
npm run run -- --repo-root ..
```

## CLI commands

Run from `orchestrator/` or use `node orchestrator/dist/cli.js`:

| Command | Description |
|---------|-------------|
| `plan` | List work items inferred from repo state |
| `sync` | Refresh `registry.json` from Cursor API |
| `run` | Sync, plan, and spawn agents (respects caps) |

Options:

- `--repo-root <path>` — repository root (default: parent of `orchestrator/`)
- `--config <path>` — config file (default: `orchestrator.config.json`)
- `--dry-run` — show spawns without calling API (`run` only)

## Work planning

The orchestrator reads:

- `data/properties/*/meta.json` — property workflow state
- `data/properties/*/audit.json` — audit routing (e.g. `NEEDS_RESEARCH`)
- `tasks/backlog/*.md` — Builder tasks
- `data/orchestrator/registry.json` — active agents
- `data/search-criteria.json` — scout markets and screening rules (via `manager.scanCriteriaFile`)

### Property state → role

| `workflow_state` | Spawns |
|------------------|--------|
| `CANDIDATE` | Scout |
| `SCREENED` (RESEARCH) | Analyst |
| `RESEARCHING` | Analyst |
| `READY_FOR_UNDERWRITING` | Analyst (legacy state; complete underwriting if evidence exists) |
| `UNDERWRITTEN` | Auditor |
| `AUDIT` + `NEEDS_RESEARCH` | Analyst |
| `AUDIT` + PASS | Manager (rank) |
| `RANKED` | Manager (publish) |
| `ARCHIVED` (rescreen due) | Scout (rescreen) |

Builder tasks in `tasks/backlog/` spawn Builder agents (one per task, respecting caps).

Only backlog files whose `**Assignee:**` is missing (defaults to Builder) or mentions **Builder** are planned. Parked Analyst/Scout/Auditor tracking tasks may live in `backlog/` without spawning Builder (e.g. TASK-016 until Scout produces US `SCREENED` candidates). Property-state rows still spawn Analyst/Scout/Auditor as usual.

When properties or backlog need triage, a Manager agent may also be planned.

## Scheduled runs

### Option A — GitHub Actions (included)

Workflow: `.github/workflows/orchestrator.yml`

| Trigger | When | Spawn scope |
|---------|------|-------------|
| **Schedule** | Daily at 07:00 UTC (~2am US Eastern during standard time) | **Full** — all pending pipeline work |
| **Push to `main`** | `data/properties/**` changes (e.g. after merging an agent PR) | **Push** — only the property(ies) in that merge |
| **Manual** | Actions → Orchestrator → Run workflow | **Full** |

After a Cloud Agent finishes, the orchestrator advances the pipeline in one of two ways:

- **Property pipeline** (`scout`, `analyst`, `auditor`, `manager`): agents push JSON artifacts **directly to `main`** (no PR). The push triggers the orchestrator for that property.
- **Builder tasks**: agents push to `agent/task-NNN-*` branches and open a PR. `.github/workflows/pull-request.yml` runs CI and **auto-merges** agent PRs when checks pass.

Registry-only commits use `[skip ci]` and do not re-trigger the workflow.

### Avoiding duplicate agents

- **Push scope:** merge property A → only property A gets the next agent (Researcher, Underwriter, etc.), not property B.
- **In-flight guard:** if an agent finished recently (PR open, &lt;48h), the same role+property will not spawn again until the window expires or registry sync marks it terminal and main state advances.
- **Manual / daily runs** still plan all pending work — use when you want to drain the full queue.

Sync registry after merges: `npm run sync -- --repo-root ..` clears stale `ACTIVE` entries.

Requires `CURSOR_API_KEY` repository secret.

### Option B — Cursor Automation webhook

1. Create an automation at [cursor.com/automations](https://cursor.com/automations)
2. Trigger: **Webhook**
3. Save to get webhook URL + API key
4. Use an external cron (GitHub Action, cron job, etc.) to POST:

```bash
curl -X POST "$AUTOMATION_WEBHOOK_URL" \
  -H "Authorization: Bearer $AUTOMATION_WEBHOOK_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Run the pipeline orchestrator for RealEstateHunter."}'
```

For webhook-triggered automations that should run the orchestrator logic, use a **repo-backed** automation with this prompt:

```
You are a pipeline runner, not an investment Manager.

1. Read docs/ORCHESTRATOR.md.
2. Run: cd orchestrator && npm ci && npm run build && npm run run -- --repo-root ..
3. Report which agents were spawned and their agent URLs from the CLI output.
4. Do not make unrelated changes.
```

Alternatively, keep the automation as a thin trigger and let **GitHub Actions** run `orchestrate run` directly (recommended — deterministic, no LLM in the loop).

## Registry

`data/orchestrator/registry.json` tracks spawned agents:

```json
{
  "version": 1,
  "entries": {
    "builder:task:TASK-001:implement-task": {
      "workKey": "builder:task:TASK-001:implement-task",
      "role": "builder",
      "agentId": "bc-...",
      "status": "ACTIVE",
      "agentUrl": "https://cursor.com/agents/bc-..."
    }
  }
}
```

Statuses: `ACTIVE` → `FINISHED` | `ERROR` | `CANCELLED` (updated on `sync` or `run`).

The orchestrator skips work items that already have an `ACTIVE` registry entry.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `CURSOR_API_KEY is required` | Set secret / env var |
| No work planned | Add property dirs under `data/properties/` or tasks in `tasks/backlog/` |
| Agent not spawning | Check role caps and `maxConcurrentAgents`; run `plan` first |
| Duplicate agents | Run `sync`; registry prevents duplicate keys |
| API 401 | Verify API key and repo access |

## Related

- Workflow states: `docs/ARCHITECTURE.md`
- Role prompts: `.cursor/agents/`
- Cloud agent setup: `AGENTS.md` → Cursor Cloud specific instructions
