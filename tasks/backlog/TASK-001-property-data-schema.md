# TASK-001: Property data schema and storage

**Status:** BACKLOG  
**Assignee:** Builder  
**Priority:** P3

## Description

Implement the property evidence and workflow file structure defined in `docs/ARCHITECTURE.md`. Agents need a consistent place to read/update property records under `data/properties/{id}/`.

## Acceptance criteria

- [x] JSON schemas in `schemas/` validate evidence, underwriting, audit, and meta files
- [ ] Helper scripts or library to create/read/update property records
- [x] Example property record in `data/properties/_example/` demonstrating all file types
- [ ] Tests for schema validation

## Remaining work

1. **`validate-property`** — validate all JSON files against schemas (useful for CI)
2. **`property-status`** — show workflow state for one or all properties
3. **`create-property`** — initialize meta.json (lowest priority; Scout creates directly)

## Manager triage (2026-08-11)

**Deprioritized to P3.** Scout (TASK-009) and Analyst create/update property JSON directly. `scripts/validate.mjs` and `lib/property` cover schema validation in CI.

Complete helper scripts only if orchestrator or agents report friction at volume.

## Notes

Reference: `docs/ARCHITECTURE.md` data layout section.
