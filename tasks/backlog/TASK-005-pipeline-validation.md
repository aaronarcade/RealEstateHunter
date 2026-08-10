# TASK-005: End-to-end pipeline validation

**Status:** BACKLOG  
**Assignee:** Builder  
**Priority:** P2

## Description

Validate that the orchestrator correctly spawns agents and the full property pipeline works end-to-end. This is a smoke test before running real property searches.

## Acceptance criteria

- [ ] Orchestrator `plan` command correctly identifies pending work from backlog tasks
- [ ] Orchestrator `plan` command correctly identifies property workflow state transitions
- [ ] Orchestrator `run --dry-run` shows expected agent spawns
- [ ] Registry tracks spawned agents correctly after real run
- [ ] Agent branches follow naming convention `agent/task-NNN-*` or `agent/{role}-*`

## Test scenarios

1. **Builder task detection**
   - Add a test task to backlog
   - Run `orchestrate plan`
   - Verify Builder agent is planned

2. **Property state transitions**
   - Create test property with `SCREENED` + `RESEARCH` decision
   - Run `orchestrate plan`
   - Verify Researcher agent is planned

3. **Dry run validation**
   - Run `orchestrate run --dry-run`
   - Verify output shows correct role assignments

## Depends on

- TASK-001 (property schema) - partial, schemas complete; **helper scripts needed**
- TASK-003 (orchestrator) - complete

## Priority note (2026-08-10 Manager triage)

With 3 real properties now in `SCREENED` state (TASK-010 ready to research), pipeline validation is less critical than completing TASK-001 helper scripts. Demote to P2 until TASK-001 remaining work is done.

## Notes

Run before heavy Scout volume (TASK-009) to ensure infrastructure is ready.
Can use the `_example` property or real screened properties as test cases.
