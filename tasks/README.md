# Tasks

Work items for the **Builder** (and occasionally Manager for process tasks).

## Directories

| Directory | Purpose |
|-----------|---------|
| `backlog/` | Proposed, not yet started |
| `active/` | Currently in progress (one per branch/worktree) |
| `done/` | Completed and merged |

## Task file format

```markdown
# TASK-NNN: Short title

**Status:** BACKLOG | ACTIVE | REVIEW | DONE
**Assignee:** Builder
**Priority:** P0 | P1 | P2

## Description

What needs to be done and why.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Notes

Optional context, dependencies, or links.
```

## Workflow

```
BACKLOG → ACTIVE → REVIEW → DONE
```

Move the file between directories as state changes. One task per git branch.

## Naming

`TASK-NNN-short-slug.md` — e.g., `TASK-001-property-data-schema.md`
