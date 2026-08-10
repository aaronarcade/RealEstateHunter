# TASK-001: Property data schema and storage

**Status:** BACKLOG  
**Assignee:** Builder  
**Priority:** P0

## Description

Implement the property evidence and workflow file structure defined in `docs/ARCHITECTURE.md`. Agents need a consistent place to read/write property records under `data/properties/{id}/`.

## Acceptance criteria

- [x] JSON schemas in `schemas/` validate evidence, underwriting, audit, and meta files
- [ ] Helper scripts or library to create/read/update property records
- [x] Example property record in `data/properties/_example/` demonstrating all file types
- [ ] Tests for schema validation

## Remaining work

1. **Helper scripts** - Create CLI or library for:
   - `create-property <id> <address> <listing_url>` - initialize meta.json with CANDIDATE state
   - `validate-property <id>` - validate all JSON files against schemas
   - `property-status [id]` - show workflow state for one or all properties

2. **Schema validation tests** - Add tests that:
   - Validate the example property against schemas
   - Test invalid inputs are rejected
   - Run in CI

## Notes

Reference: `docs/ARCHITECTURE.md` data layout section.

Schemas and example completed. Prioritize helper scripts so agents can reliably create/update records.
