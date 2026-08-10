# TASK-003: Workflow orchestrator

**Status:** DONE  
**Assignee:** Builder  
**Priority:** P2

## Description

Lightweight orchestrator that reads property `meta.json` workflow states and spawns Cursor Cloud Agents for the next required role.

## Acceptance criteria

- [x] State machine matches `docs/ARCHITECTURE.md`
- [x] Given repo state, outputs recommended next role and action (`orchestrate plan`)
- [x] Handles NEEDS_RESEARCH routing back to Researcher
- [x] Spawns Cloud Agents via API (`orchestrate run`)
- [x] Registry tracks active agents (`data/orchestrator/registry.json`)
- [x] Scheduled trigger via `.github/workflows/orchestrator.yml`
- [x] Documented in `docs/ORCHESTRATOR.md`

## Implementation

- `orchestrator/` — TypeScript CLI
- `orchestrator.config.json` — repo and concurrency config
- `.github/workflows/orchestrator.yml` — nightly cron + manual dispatch
