# TASK-001: Property data schema and storage

**Status:** ACTIVE  
**Assignee:** Builder  
**Priority:** P3

## Description

Implement the property evidence and workflow file structure defined in `docs/ARCHITECTURE.md`. Agents need a consistent place to read/update property records under `data/properties/{id}/`.

## Acceptance criteria

- [x] JSON schemas in `schemas/` validate evidence, underwriting, audit, and meta files
- [x] Helper scripts or library to create/read/update property records
- [x] Example property record in `data/properties/_example/` demonstrating all file types
- [x] Tests for schema validation

## Delivered

1. **Schemas** — `schemas/property-{meta,evidence,underwriting,audit}.json` (+ shared `field-value.json`)
2. **Library** — `lib/property` (`PropertyRecordManager`, `SchemaValidator`) with Vitest coverage
3. **CLI** — `scripts/validate-property.mjs`, `scripts/property-status.mjs`, `scripts/create-property.mjs` (+ `scripts/validate.mjs` for CI)
4. **Example** — `data/properties/_example/`
5. **Tests** — root `npm test` (`scripts/validate.test.mjs`, `scripts/property-cli.test.mjs`) and `lib/property` Vitest suite

## Manager triage (2026-08-15)

**Remains P3.** Scout (TASK-009) and Analyst create/update property JSON directly. `scripts/validate.mjs` and `lib/property` cover schema validation in CI.

CLI helpers completed 2026-08-15 to close remaining TASK-001 acceptance criteria (supersedes earlier deferral behind TASK-015).

## Notes

Reference: `docs/ARCHITECTURE.md` data layout section.
