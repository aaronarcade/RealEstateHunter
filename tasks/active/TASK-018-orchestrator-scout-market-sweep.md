# TASK-018: Orchestrator — spawn Scout for market-sweep tasks

**Status:** ACTIVE  
**Assignee:** Builder  
**Priority:** P0

## Manager triage (2026-08-22)

**Sole critical-path Builder task.** TASK-017 (scrape inventory) merged 2026-08-21 — all six US ACTIVE markets have bulk scrapes. Scout volume still stalled at 47 NDJSON because orchestrator never plans Scout for TASK-009.

| Observation | Evidence |
|-------------|----------|
| TASK-009 in `tasks/active/` assigned to Scout | Present since prior triage |
| Scout registry entries | **0** successful Scout spawns for market sweeps |
| Planner Scout routes | Property `CANDIDATE` / due `ARCHIVED` rescreen only |
| TASK-017 scrape commit | **DONE** (2026-08-21) — all five US ACTIVE scrape files on main |
| NDJSON reviewed | Still **47** (unchanged since 2026-08-13) |
| Open US RESEARCH / SCREENED | **0** |

PCB scrape already has ~574 condo beds≥2 in band. Scout cannot execute Phase A until an agent is spawned. Parallel wrong work: Analyst was still picking international RFU (e.g. nahla-60) — Manager parked 13 intl properties 2026-08-21; this task must make that defer durable in code.

### Builder work

1. **Scout task planning:** When a task file in `tasks/active/` (and optionally `tasks/backlog/`) has `**Assignee:** Scout`, plan a Scout work item (subjectType `task`, action e.g. `market-sweep`) that points the agent at that task file + `data/search-criteria.json`.
2. **Do not** route Scout-assignee tasks to Builder (already skipped via assignee filter — keep that).
3. **Defer international property roles:** When `scout_instructions.volume_targets.defer_international_until_us_targets_met` is true (or `data/pipeline-status.json` gap says so), **do not** plan Analyst/Auditor for properties whose `market_id` is outside US ACTIVE markets in `market_sweep_order` / ACTIVE status — until volume targets are met or Manager clears the flag.
4. Tests covering: Scout task spawn from active Scout task; Builder still skipped for Scout assignee; Analyst skipped for parked/deferred intl markets.
5. Update `docs/ORCHESTRATOR.md` + `docs/DECISIONS.md` ADR for the behavior.

### Out of scope

- Running Scout screening yourself
- New scrapes (TASK-017)
- UI work

## Description

Unblock high-volume condo Scout sweeps by teaching the orchestrator to spawn Scout agents for Scout-assigned market-sweep tasks, and stop burning Analyst/Auditor capacity on deferred international inventory.

## Acceptance criteria

- [ ] Scout-assignee task in `tasks/active/` (TASK-009) produces a planned Scout work item
- [ ] Scout prompt includes path to the task file and search-criteria / pipeline-status
- [ ] Builder is not planned for Scout-assignee tasks
- [ ] With defer flag on, Analyst/Auditor are not planned for non-US-ACTIVE `market_id`s
- [ ] Unit tests for planner/repo changes
- [ ] Docs updated (ORCHESTRATOR + DECISIONS)

## Depends on

- `orchestrator/src/planner.ts`, `orchestrator/src/repo.ts`
- `data/search-criteria.json` volume_targets
- TASK-009 (consumer)

## Blocks

- Reliable autonomous execution of TASK-009 Scout condo volume sweep

## Notes

Priority over nice-to-haves: this is the **only remaining critical-path software fix** for US Scout volume. TASK-017 (scrape JSON) is done — Scout can execute TASK-009 offline on all six US ACTIVE markets once this orchestrator fix lands or a Scout agent is spawned manually.
