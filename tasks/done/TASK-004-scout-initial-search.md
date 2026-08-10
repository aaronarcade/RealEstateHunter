# TASK-004: Scout initial property search

**Status:** DONE  
**Assignee:** Scout  
**Priority:** P0

## Description

Conduct initial property search across target markets to identify CANDIDATE properties with potential for ≥10% unlevered cap rate.

## Search criteria

Read `data/search-criteria.json` for:
- Target markets (Tampa FL, Jacksonville FL, Birmingham AL, Memphis TN, Cleveland OH)
- Property types (condo, townhouse, single family)
- Price range ($75k - $300k)
- Minimum beds/baths (2 bed, 1 bath)
- Screening threshold (12% gross yield minimum)

**Manager-directed markets for this run:** Panama City Beach FL, Celebration FL, Cuenca Ecuador (per spawn prompt).

## Acceptance criteria

- [x] Search at least 3 priority markets
- [x] Screen listings against gross yield threshold (≥12%)
- [x] Create `data/properties/{id}/meta.json` for properties that pass screening
- [x] Document REJECT decisions with reasoning for borderline cases
- [x] Flag properties with HOA > $500/month for additional scrutiny

## Output

For each promising listing:
1. Create property directory: `data/properties/{slug}/`
2. Create `meta.json` with:
   - `workflow_state`: `SCREENED`
   - `scout_decision`: `RESEARCH`
   - Listing URL, address, rough price/rent/yield

## Results (2026-08-10)

**RESEARCH (3):**
- `9860-s-thomas-dr-unit-917-panama-city-beach-fl` — 19.0% gross (documented $53k STR 2025)
- `17462-front-beach-rd-unit-31c-panama-city-beach-fl` — 15.5% gross (Mashvisor STR est.)
- `225-celebration-pl-unit-526-celebration-fl` — 20.7% gross (Melia comp STR est.)

**Screening log:** `data/scout/task-004-screening-log.json`

Cuenca: no listings passed 12% gross yield with supportable rent evidence.

## Notes

First Scout search - focus on finding 3-5 promising candidates rather than volume.
Quality over quantity: properties should have realistic path to 10% cap rate.
