# TASK-016: Analyst batch — next US SCREENED candidates

**Status:** BACKLOG  
**Assignee:** Analyst  
**Priority:** P0 (activate when Scout produces US SCREENED)

## Manager triage (2026-08-20)

**Parked until Scout (TASK-009) produces ≥1 US ACTIVE property with `workflow_state: SCREENED`.**

US pipeline is empty after three audited REJECTED archives (Horizon South 6.0%, Celebration Melia 7.85%, Laketown Wharf 9.0%). International backlog remains **deprioritized**:

- 11 READY_FOR_UNDERWRITING (mostly Manta)
- 2 UNDERWRITTEN REJECTED pending audit (`fez-manta-unit-209`, `cuenca-banos-ultramodern-mansion`) — do **not** spawn Auditor on these ahead of US Scout volume
- `cuenca-putishi` Auditor PASS REJECTED (3.07%) — Manager archived 2026-08-20

Activate this task immediately when Scout commits new US SCREENED candidates — do not wait for full 10-candidate batch.

## Description

Complete diligence (`evidence.json`) and underwriting (`underwriting.json`) for all US ACTIVE market properties in `SCREENED` state produced by TASK-009.

## Instructions

1. Read `docs/PRODUCT.md` for cap rate formulas and classification rules.
2. For each US ACTIVE SCREENED property (check `market_id` in `tampa-fl`, `jacksonville-fl`, `birmingham-al`, `memphis-tn`, `cleveland-oh`, `panama-city-beach-fl`):
   - Build complete `evidence.json` with verified/estimated/unknown status on all material fields.
   - Build `underwriting.json` with NOI, cap rate, sensitivity, and proposed status.
   - Update `meta.json` to `UNDERWRITTEN`.
3. Propose VIABLE only when cap rate ≥10% with sufficiently verified inputs (HOA, assessments, rent, price).
4. Do not finalize VIABLE — route to Auditor.

## Acceptance criteria

- [ ] Every US ACTIVE SCREENED property at task activation has complete `evidence.json` and `underwriting.json`
- [ ] Calculations follow `docs/PRODUCT.md` formulas
- [ ] Proposed status justified with documented rationale
- [ ] `meta.json` updated to `UNDERWRITTEN`
- [ ] Sensitivity analysis included for borderline cases

## Depends on

- TASK-009 Scout volume sweep producing US SCREENED candidates
- `schemas/evidence.json`, `schemas/underwriting.json`

## Blocks

- Auditor review of any proposed VIABLE US candidates

## Notes

Prior batch TASK-012 covered the first two US properties (both REJECTED). PCB lessons: high gross yield with HOA + STR management often fails 10% cap — verify LTR comps and all operating expenses conservatively.
