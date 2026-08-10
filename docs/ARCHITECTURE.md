# Architecture

## Agent System

Five roles with asymmetric authority. No agent has unilateral authority over everything.

| Role | Authority | Does not |
|------|-----------|----------|
| **Manager** | Product scope, prioritization, ranking, notifications | Research listings, calculate deals |
| **Scout** | Early reject / send to research | Classify as VIABLE |
| **Analyst** | Property evidence file + underwriting | Finalize VIABLE without Auditor |
| **Auditor** | Block merge; downgrade status | Upgrade to VIABLE |
| **Builder** | Implementation | Investment decisions |

Role prompts: `.agents/` (human-readable source of truth) and `.cursor/agents/` (Cursor subagent delegation)

## Property Workflow

```
CANDIDATE
    ↓
SCREENED          (Scout: REJECT or RESEARCH)
    ↓
RESEARCHING       (Analyst: evidence + underwriting)
    ↓
UNDERWRITTEN      (Analyst complete; ready for Auditor)
    ↓
AUDIT             (Auditor: PASS or NEEDS_RESEARCH)
    ├── NEEDS_RESEARCH → Analyst
    └── PASS → Manager
    ↓
RANKED            (Manager: rank opportunities)
    ↓
PUBLISHED

ARCHIVED          (Scout/Manager: infeasible for now, scheduled rescreen)
    ↓ (rescreen_after due)
CANDIDATE/SCREENED (Scout: re-check listing; promote if improved)
```

### Rescreen policy

Infeasible listings are **not discarded**. Scout and Manager archive them with `rescreen_after` per `data/search-criteria.json` → `rescreen_policy`:

| Reason | Default interval |
|--------|------------------|
| Scout reject | 30 days |
| WATCHLIST | 45 days |
| Audit/diligence reject | 60 days |
| Listing inactive | 90 days |

Scout compares the live listing to `screening_snapshot` (price, rent, yield). Orchestrator spawns Scout when `rescreen_after` is due.

### Orchestration rules

- If gross yield < 10% at scout stage: archive with `rescreen_after` (do not discard the listing).
- If HOA unknown: route back to Analyst.
- If assessment unknown: **WATCHLIST** at most unless evidence indicates none exists.
- If underwriting complete: send to Auditor.
- If audit requests more evidence: route back to Analyst.
- If **VIABLE**: add to ranked opportunities.
- If audit **REJECTED** or **WATCHLIST**: Manager archives with `rescreen_after` for periodic rescreen.
- If significant new **VIABLE** property appears: notify Aaron.

### Pipeline orchestrator

Automated agent spawning is handled by `orchestrator/` — see `docs/ORCHESTRATOR.md`.

| Trigger | Action |
|---------|--------|
| GitHub Action (daily cron) | Runs `orchestrate run`, commits `registry.json` |
| Manual CLI | `cd orchestrator && npm run run -- --repo-root ..` |
| Cursor Automation webhook | Optional; GitHub Action is recommended |

The orchestrator reads property workflow state and `tasks/backlog/`, then calls the Cursor Cloud Agents API to create role-specific agent instances. `data/orchestrator/registry.json` tracks active spawns.

## Data Layout

```
data/properties/{property-id}/
├── meta.json           # Address, listing URL, workflow state
├── evidence.json       # Analyst output (structured fields)
├── underwriting.json   # Analyst output (NOI, cap rate, proposed status)
└── audit.json          # Auditor output
```

Property IDs should be stable slugs (e.g., `123-main-st-tampa-fl`).

## Data Schema

### Field value (used throughout evidence and underwriting)

Every material financial value uses this shape:

```json
{
  "value": 485,
  "status": "VERIFIED",
  "confidence": "HIGH",
  "source": "https://listing-url",
  "evidence": "Listing states HOA fee of $485/month"
}
```

- `status`: `VERIFIED` | `ESTIMATED` | `UNKNOWN`
- `confidence`: `HIGH` | `MEDIUM` | `LOW`
- `value`: number or `null` when unknown

### Evidence file (`evidence.json`)

Analyst-owned (Phase 1). Required fields:

- `purchase_price`
- `monthly_rent`
- `hoa_monthly`
- `special_assessments`
- `property_taxes_annual`
- `insurance_annual`
- `management_annual`
- `utilities_annual`
- `other_expenses_annual`
- `rental_restrictions`
- `str_restrictions`

### Underwriting file (`underwriting.json`)

Analyst-owned (Phase 2). Outputs:

```json
{
  "annual_gross_rent": 36000,
  "annual_operating_expenses": 12800,
  "noi": 23200,
  "cap_rate": 0.116,
  "proposed_status": "VIABLE",
  "computed_at": "2026-08-09T00:00:00Z"
}
```

### Audit file (`audit.json`)

Auditor-owned. Outputs:

```json
{
  "result": "PASS",
  "final_status": "VIABLE",
  "findings": [],
  "audited_at": "2026-08-09T00:00:00Z"
}
```

`result`: `PASS` | `NEEDS_RESEARCH` | `DOWNGRADE`

Auditor may downgrade `VIABLE → WATCHLIST`, `VIABLE → REJECTED`, or `WATCHLIST → REJECTED`. Auditor may **not** upgrade to VIABLE.

### Published opportunity (UI contract)

```typescript
interface PropertyOpportunity {
  id: string
  address: string
  location: string
  listingUrl: string

  purchasePrice: FieldValue
  monthlyRent: FieldValue

  annualGrossRent: number
  annualOperatingExpenses: number
  noi: number
  capRate: number

  hoa: FieldValue
  assessment: FieldValue

  confidence: "HIGH" | "MEDIUM" | "LOW"
  status: "VIABLE" | "WATCHLIST" | "REJECTED"

  sources: Source[]
  rankedAt?: string
}
```

JSON Schema: `schemas/property-opportunity.json`

## Task Workflow

Tasks are markdown files moved between directories:

```
tasks/backlog/TASK-NNN-slug.md
tasks/active/TASK-NNN-slug.md
tasks/done/TASK-NNN-slug.md
```

Suggested task states for software work: `BACKLOG → ACTIVE → REVIEW → DONE`

## Git Conventions

- Branch naming: `agent/task-NNN-short-description`
- One task per branch
- Use worktrees for parallel agent work
- Builder merges via PR; never commit directly to `main`

## Information Boundaries

Agents should know the minimum information necessary for their decision:

| Agent | Needs | Does not need |
|-------|-------|---------------|
| Manager | Goal, 10% threshold, classification rules, workflow | Scraping logic, UI implementation |
| Scout | Price, rough rent, rough fees, location, listing link | Full expense model |
| Analyst | Required fields, evidence rules, formulas, thresholds | Portfolio ranking logic |
| Auditor | Full underwriting standard, evidence record | Search strategy |
| Builder | Data schema, UI contract, agent outputs | Investment judgment |
