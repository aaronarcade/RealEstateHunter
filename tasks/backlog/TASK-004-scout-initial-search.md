# TASK-004: Scout initial property search

**Status:** BACKLOG  
**Assignee:** Scout  
**Priority:** P0

## Description

Conduct high-volume property search across target markets. **Prioritize condominium buildings** (multi-unit complexes with HOA on listing). Identify CANDIDATE properties with potential for ≥10% unlevered cap rate.

## Search criteria

Read `data/search-criteria.json` for:

- Target markets (Tampa FL, Jacksonville FL, Birmingham AL, Memphis TN, Cleveland OH)
- **Asset focus:** condo buildings first (`asset_focus.prioritize_condo_buildings`)
- Property types (condo primary; townhouse/SFH secondary only after condo pass)
- Price range ($75k - $750k)
- Minimum beds/baths (2 bed, 1 bath)
- Screening threshold (10% gross yield minimum)
- Volume targets (`scout_instructions.volume_targets`)

## Acceptance criteria

- [ ] Search at least 3 priority markets with **condo filter first** in each
- [ ] Review **≥40 listings per market** (document if market is dry)
- [ ] Screen listings against gross yield threshold (≥10%); HOA-adjusted check for condos
- [ ] Create `data/properties/{id}/meta.json` for **≥10 RESEARCH** candidates when inventory allows (≥3 per market)
- [ ] Include `building_name` and `property_type: condo` on condo records when known
- [ ] When one unit in a building passes, review other units in the same building
- [ ] Document REJECT decisions for borderline cases
- [ ] Flag properties with HOA > $500/month for additional scrutiny

## Output

For each promising listing:

1. Create property directory: `data/properties/{slug}/`
2. Create `meta.json` with:
   - `workflow_state`: `SCREENED`
   - `scout_decision`: `RESEARCH`
   - Listing URL, address, unit, building name, rough price/rent/yield

## Notes

**Do not stop at 3–5 candidates** — that was an initial bootstrap target. Scan volume first, then filter. Quality still matters: each RESEARCH should have a realistic path to 10% cap after expenses.
