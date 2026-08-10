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

- Never commit directly to `main` **except** Manager, Scout, Analyst, and Auditor property pipeline work (orchestrator pushes to `main` when `roles.*.autoCreatePR` is `false`).
- Builder and human contributors: one task per branch, PR required.
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
| **Analyst** | Property evidence + underwriting (diligence and cap rate) |
| **Auditor** | Evidence validation; can block or downgrade |
| **Builder** | Software, data pipeline, UI |

Role prompts live in `.agents/`. Cursor-native subagents (for delegation via `/manager`, `/scout`, etc.) live in `.cursor/agents/`. Keep both in sync when role rules change. Read only the prompt for your assigned role plus `AGENTS.md`.

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
- Scout search params: `data/search-criteria.json`

## Cursor Cloud specific instructions

These rules apply when running as a **Cursor Cloud Agent** against this repository.

### Before you start

1. Read `AGENTS.md` (this file) and **only** your role prompt in `.agents/<role>.md`.
2. Confirm your assigned role (Manager, Scout, Analyst, Auditor, or Builder).
3. Do not rely on conversation history from other agents — read current Git artifacts instead.

### Branching and PRs

| Role | Branch | PR |
|------|--------|-----|
| Manager, Scout, Analyst, Auditor | `main` (direct push) | No |
| Builder | `agent/task-NNN-short-description` | Yes (auto-merged when CI passes) |

- Builder and manual work: never commit directly to `main`.
- One task or property workflow per agent run.
- Builder PRs should include what changed, test/build results, and which artifacts were updated.
- Cloud agents on feature branches use `agent/` or `cursor/` prefixes.

### Role-specific cloud behavior

| Role | Read | Write | Do not |
|------|------|-------|--------|
| **Manager** | `tasks/`, `data/properties/`, `docs/PRODUCT.md` | `tasks/backlog/`, property `meta.json` workflow state | Research listings, write application code |
| **Scout** | `.agents/scout.md`, Manager search criteria | `data/properties/{id}/meta.json`, scout screening output | Classify VIABLE/WATCHLIST/REJECTED |
| **Analyst** | Assigned property in `data/properties/`, `docs/PRODUCT.md` | `evidence.json`, `underwriting.json`, update `meta.json` state | Finalize VIABLE without Auditor |
| **Auditor** | Full property record + `docs/PRODUCT.md` | `audit.json`, final status in `meta.json` | Upgrade to VIABLE; rewrite implementation |
| **Builder** | Assigned task in `tasks/active/` or `tasks/backlog/` | Application code, tests, schemas | Investment or classification decisions |

### Artifacts and workflow

- Property candidates follow the state machine in `docs/ARCHITECTURE.md`:

  `CANDIDATE → SCREENED → RESEARCHING → UNDERWRITTEN → AUDIT → RANKED → PUBLISHED`

  (`READY_FOR_UNDERWRITING` is a legacy intermediate state; Analyst now completes diligence and underwriting in one run.)

  Infeasible listings go to `ARCHIVED` with `rescreen_after`; Scout rescreens when due.

- Write structured JSON under `data/properties/{id}/` using schemas in `schemas/`.
- Every material financial field must include `value`, `status` (`VERIFIED` | `ESTIMATED` | `UNKNOWN`), `confidence`, `source`, and `evidence`.
- Move Builder tasks: `tasks/backlog/` → `tasks/active/` → `tasks/done/` as work progresses.

### Validation

- Run relevant tests and build commands before opening a PR.
- If no test suite exists yet, state what you verified manually.
- Builder changes that alter behavior must update docs and add tests when applicable.
- Investment analysis is not done until **Auditor** approves any proposed **VIABLE** classification.

### Secrets and external access

- Use secrets configured in the Cursor Cloud environment dashboard — do not commit credentials.
- Record external sources in artifact `source` and `evidence` fields, not in chat-only summaries.

### Parallel work

- Multiple cloud agents may run concurrently on different branches.
- Coordinate only through Git artifacts and PRs — do not assume another agent's chat context.
- Invoke role subagents explicitly: `/manager`, `/scout`, `/analyst`, `/auditor`, `/builder`
- Example worktree (local or documented in PR): `git worktree add ../RealEstateHunter-task-101 -b agent/task-101`

### First Builder task

If no other task is assigned, start with `tasks/backlog/TASK-001-property-data-schema.md` on branch `agent/task-001`.

### Orchestrator-spawned agents

You may be created automatically by the pipeline orchestrator (`docs/ORCHESTRATOR.md`):

- Read the role and target branch from your spawn prompt.
- Your work item key is tracked in `data/orchestrator/registry.json`.
- Property roles: push directly to `main` when your spawn prompt says so (no PR).
- Builder: push to your task branch and open a PR (auto-merged when CI passes).
- Do not start work outside your assigned role or property/task scope.
