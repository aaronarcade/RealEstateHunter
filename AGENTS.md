# Agent Instructions

## Goal

Identify a small number of well-supported real estate investment opportunities suitable for rental use that are capable of producing an **unlevered cap rate of 10% or greater**.

Prioritize investment quality and confidence over the number of listings found.

## Priorities

1. Working software
2. Maintainability
3. Tests
4. Small changes
5. Documentation

## Rules

- Never commit directly to `main`.
- One task per branch.
- Do not modify unrelated code.
- Read `docs/ARCHITECTURE.md` before making structural changes.
- Add tests for behavioral changes.
- Update documentation when behavior changes.
- Do not introduce dependencies without explaining why in `docs/DECISIONS.md`.
- Prefer existing patterns over inventing new ones.
- Agents communicate through Git artifacts (tasks, property records, docs), not shared chat history.
- Use isolated git worktrees for parallel agent work:

```bash
git worktree add ../RealEstateHunter-task-101 -b agent/task-101
```

## Roles

| Role | Owns |
|------|------|
| **Manager** | Goal, prioritization, workflow state, ranking |
| **Scout** | Fast first-pass screening |
| **Researcher** | Property evidence file (facts + sources) |
| **Underwriter** | NOI, cap rate, proposed classification |
| **Auditor** | Evidence validation; can block or downgrade |
| **Builder** | Software, data pipeline, UI |

Role prompts live in `.agents/`. Read only the prompt for your assigned role plus `AGENTS.md`.

## Definition of Done

- Task requirements satisfied
- Tests pass
- Build passes
- No unexplained scope changes
- Auditor approves (for investment analysis artifacts)

## Key References

- Product rules: `docs/PRODUCT.md`
- System design: `docs/ARCHITECTURE.md`
- Architectural decisions: `docs/DECISIONS.md`
- Tasks: `tasks/backlog/`, `tasks/active/`, `tasks/done/`
- Property records: `data/properties/`
