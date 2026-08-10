# TASK-004: Scout initial property search

**Status:** BACKLOG  
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

## Acceptance criteria

- [ ] Search at least 3 priority markets
- [ ] Screen listings against gross yield threshold (≥12%)
- [ ] Create `data/properties/{id}/meta.json` for properties that pass screening
- [ ] Document REJECT decisions with reasoning for borderline cases
- [ ] Flag properties with HOA > $500/month for additional scrutiny

## Output

For each promising listing:
1. Create property directory: `data/properties/{slug}/`
2. Create `meta.json` with:
   - `workflow_state`: `SCREENED`
   - `scout_decision`: `RESEARCH`
   - Listing URL, address, rough price/rent/yield

## Notes

First Scout search - focus on finding 3-5 promising candidates rather than volume.
Quality over quantity: properties should have realistic path to 10% cap rate.
