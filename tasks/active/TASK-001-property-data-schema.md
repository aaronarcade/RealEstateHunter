# TASK-001: Property data schema and storage

**Status:** ACTIVE  
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

## Urgency note (2026-08-10 Manager triage)

Scout (TASK-009) and Researcher (TASK-010) are ready to generate/update property records at volume. Helper scripts are needed to:
- Let Scout batch-create `meta.json` reliably
- Let Researcher validate evidence files before committing
- Let orchestrator verify property state

**Complete helper scripts before TASK-009 starts heavy volume scanning.**

## Notes

Reference: `docs/ARCHITECTURE.md` data layout section.

Schemas and example completed. Prioritize helper scripts so agents can reliably create/update records.

## Manager triage (2026-08-10)

**Remaining work priority:**
1. `validate-property` script — needed for CI and orchestrator validation
2. `property-status` script — useful for Manager/orchestrator to query state
3. `create-property` script — lower priority; Scout creates properties directly via JSON

**Recommendation:** Complete helper scripts before TASK-005 (pipeline validation) so validation tests have proper tooling. This unblocks orchestrator reliability testing.

**Dependencies for other roles:**
- Scout (TASK-009) can create `meta.json` directly without helper scripts
- Researcher (TASK-010) can update `evidence.json` and `meta.json` directly
- Builder should prioritize TASK-007 (Supabase) over completing helper scripts if blocked
