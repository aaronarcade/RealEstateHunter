# TASK-005: End-to-end pipeline validation

<<<<<<<< HEAD:tasks/active/TASK-005-pipeline-validation.md
**Status:** COMPLETE  
========
**Status:** DONE  
>>>>>>>> agent/manager-triage:tasks/done/TASK-005-pipeline-validation.md
**Assignee:** Builder  
**Priority:** P1

## Description

Validate that the orchestrator correctly spawns agents and the full property pipeline works end-to-end. This is a smoke test before running real property searches.

## Acceptance criteria

- [x] Orchestrator `plan` command correctly identifies pending work from backlog tasks
- [x] Orchestrator `plan` command correctly identifies property workflow state transitions
- [x] Orchestrator `run --dry-run` shows expected agent spawns
- [x] Registry tracks spawned agents correctly after real run
- [x] Agent branches follow naming convention `agent/task-NNN-*` or `agent/{role}-*`

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

Run before heavy Scout volume (TASK-009) to ensure infrastructure is ready.
Can use the `_example` property or real screened properties as test cases.

## Completion

Completed 2026-08-10 via PR #6. Tests added to `orchestrator/src/`.
