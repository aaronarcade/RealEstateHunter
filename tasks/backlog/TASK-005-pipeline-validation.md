# TASK-005: End-to-end pipeline validation

**Status:** BACKLOG  
**Assignee:** Builder  
**Priority:** P1

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

- TASK-001 (property schema) - partial, schemas complete
- TASK-003 (orchestrator) - complete

## Notes

Run before TASK-004 (scout search) to ensure infrastructure is ready.
Can use the `_example` property as a test case by temporarily changing its state.
