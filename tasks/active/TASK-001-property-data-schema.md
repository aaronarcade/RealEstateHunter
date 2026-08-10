# TASK-001: Property data schema and storage

**Status:** ACTIVE  
**Assignee:** Builder  
**Priority:** P0

## Description

Implement the property evidence and workflow file structure defined in `docs/ARCHITECTURE.md`. Agents need a consistent place to read/write property records under `data/properties/{id}/`.

## Acceptance criteria

- [ ] JSON schemas in `schemas/` validate evidence, underwriting, audit, and meta files
- [ ] Helper scripts or library to create/read/update property records
- [ ] Example property record in `data/properties/_example/` demonstrating all file types
- [ ] Tests for schema validation

## Notes

Reference: `docs/ARCHITECTURE.md` data layout section.
