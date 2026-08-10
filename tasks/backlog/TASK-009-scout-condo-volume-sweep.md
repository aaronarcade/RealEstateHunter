# TASK-009: Scout condo building volume sweep

**Status:** BACKLOG  
**Assignee:** Scout  
**Priority:** P0

## Description

Execute a high-volume condo-focused search sweep across all 5 active markets defined in `data/search-criteria.json`. The goal is to identify enough candidates to meet volume targets before funneling survivors into Researcher.

**Current gap:** Only 3 properties screened to date, all outside the 5 defined markets. Volume targets (40 listings/market, 10 research candidates total, 3+ per market) are not met.

## Markets (priority order per search-criteria.json)

1. Tampa, FL
2. Jacksonville, FL
3. Panama City Beach, FL *(added 2026-08-10 — 2 candidates already passed screen)*
4. Birmingham, AL
5. Memphis, TN
6. Cleveland, OH
7. Celebration, FL (Orlando metro) — WATCH status *(high HOA condo-hotel; monitor only)*

## Instructions

Follow `data/search-criteria.json` → `scout_instructions` and `condo_building_search` strategy:

1. **Filter each market for Condo / Condominium only first** (before SFH or townhouse).
2. **Search by building name or street address** when a condo complex has multiple active listings.
3. When one unit in a building passes yield screen, review other units in same building.
4. Prefer established condo buildings (20+ units) with published HOA fees on listing.
5. Record `building_name` and `unit` in `meta.json` when available.

### Yield screening

- Gross yield must be ≥ 10% to pass to RESEARCH.
- For condos with stated HOA, also compute quick adjusted yield: `(monthly_rent - hoa_monthly) * 12 / price`. Flag if below 8% even when gross yield passes.
- HOA over $500/month requires extra scrutiny (do not auto-reject, but note risk).

### Volume targets

| Metric | Target |
|--------|--------|
| Listings reviewed per market | ≥ 40 |
| Research candidates total | ≥ 10 |
| Research candidates per market | ≥ 3 |

**Do not stop early.** Continue scanning until targets are met or no more listings match filters.

## Output

For each candidate passing screen:

1. Create `data/properties/{id}/meta.json` with:
   - `workflow_state: "SCREENED"`
   - `scout_decision: "RESEARCH"` or `"REJECT"`
   - `property_type`, `beds`, `baths`
   - `asking_price`, `rough_monthly_rent`, `rough_gross_yield`
   - `advertised_hoa` (if stated)
   - `market_id` matching `search-criteria.json`
   - `scout_notes` with MLS ID, building name, rent source, flags

2. For rejects with gross yield < 10%, archive with `rescreen_after` per policy (30 days).

3. Commit properties in logical batches (per market or per ~10 candidates).

## Acceptance criteria

- [ ] All 5 active markets searched with condo filter first
- [ ] Volume targets met or documented shortfall with explanation
- [ ] Each candidate has complete `meta.json` per schema
- [ ] Building name and unit recorded when available
- [ ] HOA > $500/month flagged in `scout_notes`
- [ ] Rejects have `rescreen_after` set per `rescreen_policy`

## Depends on

- `data/search-criteria.json` — current version
- `schemas/property-meta.json` — for meta.json structure

## Notes

Panama City Beach added to active markets (2026-08-10) based on early Scout results. Celebration FL set to WATCH status due to condo-hotel complexity and high HOA.

Focus on defined ACTIVE markets; skip WATCH markets unless price drops make them compelling.
