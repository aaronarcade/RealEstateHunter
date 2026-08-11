# TASK-009: Scout condo building volume sweep

**Status:** ACTIVE  
**Assignee:** Scout  
**Priority:** P0

## Manager triage (2026-08-11)

**Critical gap:** US ACTIVE markets have almost no scout coverage. Only Panama City Beach has RESEARCH candidates (2). Tampa, Jacksonville, Birmingham, Memphis, and Cleveland have **zero** listings reviewed.

| Market | Priority | Listings Reviewed | RESEARCH | Target |
|--------|----------|-------------------|----------|--------|
| Tampa, FL | 1 | 0 | 0 | 40 / 3 |
| Jacksonville, FL | 2 | 0 | 0 | 40 / 3 |
| Panama City Beach, FL | 3 | 5 | 2 | 40 / 3 |
| Birmingham, AL | 4 | 0 | 0 | 40 / 3 |
| Memphis, TN | 5 | 0 | 0 | 40 / 3 |
| Cleveland, OH | 6 | 0 | 0 | 40 / 3 |

**Total reviewed (NDJSON):** 47 — but 39 are Manta EC rejects. US reviewed = 6.

**Do not expand international** (Manta/Cuenca) until US ACTIVE markets meet volume targets per `data/search-criteria.json` → `defer_non_us_markets`.

## Phased sweep order

1. **Phase A (P0):** Tampa + Jacksonville — condo-only, building-cluster search using `seed_buildings` in search-criteria
2. **Phase B (P1):** Birmingham, Memphis, Cleveland — condo-only sweeps
3. **Phase C:** Continue PCB building clusters (Laketown Wharf, Horizon South, Shores of Panama, Grand Panama)

## Description

Execute a high-volume condo-focused search sweep across all 6 US ACTIVE markets defined in `data/search-criteria.json`. The goal is to identify enough candidates to meet volume targets before funneling survivors into Analyst.

## Instructions

Follow `data/search-criteria.json` → `scout_instructions`, `market_sweep_order`, and `condo_building_search` strategy:

1. **Filter each market for Condo / Condominium only first** (before SFH or townhouse).
2. **Start with seed buildings** when listed for a market; then broaden to full market scan.
3. **Search by building name or street address** when a condo complex has multiple active listings.
4. When one unit in a building passes yield screen, review other units in same building.
5. Prefer established condo buildings (20+ units) with published HOA fees on listing.
6. Record `building_name` and `unit` in `meta.json` when available.

### Yield screening

- Gross yield must be ≥ 10% to pass to RESEARCH.
- For condos with stated HOA, also compute quick adjusted yield: `(monthly_rent - hoa_monthly) * 12 / price`. Flag if below 8% even when gross yield passes.
- HOA over $500/month requires extra scrutiny (do not auto-reject, but note risk).

### Volume targets

| Metric | Target |
|--------|--------|
| Listings reviewed per market | ≥ 40 |
| Research candidates total (US ACTIVE) | ≥ 10 |
| Research candidates per market | ≥ 3 |

**Do not stop early.** Continue scanning until targets are met or document dry-market rationale in PR description.

### Reject handling

- REJECT → write to `data/reviewed/listings.ndjson` only (no full property dir)
- RESEARCH → create full `data/properties/{id}/` with `workflow_state: "SCREENED"`

## Output

For each candidate passing screen:

1. Create `data/properties/{id}/meta.json` with:
   - `workflow_state: "SCREENED"`
   - `scout_decision: "RESEARCH"`
   - `property_type`, `building_name`, `unit`, `beds`, `baths`
   - `asking_price`, `rough_monthly_rent`, `rough_gross_yield`
   - `advertised_hoa` (if stated)
   - `market_id` matching `search-criteria.json`
   - `scout_notes` with MLS ID, building name, rent source, flags

2. For rejects, append to `data/reviewed/listings.ndjson` with `scout_decision: "REJECT"`.

3. Commit in logical batches (per market or per ~10 candidates).

## Acceptance criteria

- [ ] All 6 US ACTIVE markets searched with condo filter first
- [ ] Volume targets met or documented shortfall with dry-market rationale per market
- [ ] Each RESEARCH candidate has complete `meta.json` per schema
- [ ] Building name and unit recorded when available
- [ ] HOA > $500/month flagged in `scout_notes`
- [ ] Rejects logged to `data/reviewed/listings.ndjson`
- [ ] No new international RESEARCH until US targets met

## Depends on

- `data/search-criteria.json` v3
- `data/pipeline-status.json` — current gap snapshot
- `schemas/property-meta.json`, `schemas/reviewed-listing.json`

## Notes

Panama City Beach has early success (2 RESEARCH, 19%+ gross yields). Use PCB seed buildings as a model for Tampa/Jacksonville cluster searches. Celebration FL remains WATCH — do not prioritize over ACTIVE markets. Use `data/scrapes/panama-city-beach-fl-active-listings-2026-08-10.json` as reference for bulk condo inventory in PCB.
