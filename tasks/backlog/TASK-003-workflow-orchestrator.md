# TASK-003: Workflow orchestrator skeleton

**Status:** BACKLOG  
**Assignee:** Builder  
**Priority:** P2

## Description

Create a lightweight orchestrator that reads property `meta.json` workflow states and knows which agent role should act next. Does not need full automation initially — a CLI that reports "next action" per property is sufficient.

## Acceptance criteria

- [ ] State machine matches `docs/ARCHITECTURE.md`
- [ ] Given a property ID, outputs recommended next role and action
- [ ] Handles NEEDS_RESEARCH routing back to Researcher
- [ ] Documented usage in README or docs

## Notes

Enables continuous operation with minimal human intervention. Manager rules in `.agents/manager.md`.
