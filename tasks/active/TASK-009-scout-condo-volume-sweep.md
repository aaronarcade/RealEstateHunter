# TASK-009: Scout condo building volume sweep

**Status:** ACTIVE  
**Assignee:** Scout  
**Priority:** P0

## Manager triage (2026-08-19)

**Still the critical path. No Scout volume progress since 2026-08-13 (NDJSON still 47; open US RESEARCH = 0; zero SCREENED properties).**

US pipeline fully audited: all 3 US RESEARCH properties ARCHIVED REJECTED (Horizon South 6.0%, Melia Celebration 7.85%, Laketown Wharf 9.0%). **Auditor queue empty. Analyst queue empty.** Scout volume is the only path to new VIABLE candidates.

| Market | Priority | Listings Reviewed | RESEARCH open | Target | Bulk Scrape |
|--------|----------|-------------------|---------------|--------|-------------|
| Panama City Beach, FL | 3 | 5 | 0 (2 archived) | 40 / 3 | ✅ **1,074 condos** (~574 beds≥2 in band) |
| Tampa, FL | 1 | 0 | 0 | 40 / 3 | ❌ TASK-015 |
| Jacksonville, FL | 2 | 0 | 0 | 40 / 3 | ❌ TASK-015 |
| Birmingham, AL | 4 | 0 | 0 | 40 / 3 | ❌ TASK-015 |
| Memphis, TN | 5 | 0 | 0 | 40 / 3 | ❌ TASK-015 |
| Cleveland, OH | 6 | 0 | 0 | 40 / 3 | ❌ TASK-015 |

**Total reviewed (NDJSON):** 47 — 39 Manta EC rejects, 6 US (5 PCB + 1 Celebration), 2 Cuenca. **Open US ACTIVE RESEARCH = 0.**

### Execute immediately (do not wait for TASK-015)

**Phase A — Panama City Beach scrape (P0, unblocked):**

1. Filter `data/scrapes/panama-city-beach-fl-active-listings-2026-08-10.json` for `property_type: "condo"`, **`beds >= 2`**, price `$75k–$750k`.
2. Building clusters in **beds≥2 median-HOA order** (see `search-criteria.json` v7 `seed_buildings`):
   - **8700 Front Beach Rd** (~16 beds≥2) — median HOA ~$672 (**START HERE**)
   - **Horizon South** — `17462 Front Beach Rd` (~12 beds≥2) — med HOA ~$636 but Unit 31C REJECTED 6.0%; siblings only if better ask/rent
   - **16819 Front Beach Rd** (~17) — mid-tier Front Beach volume
   - **11807 Front Beach Rd** (~15) — median HOA ~$839; lower-HOA Front Beach before high-HOA towers
   - **Shores of Panama** — `9900` + `9902 S Thomas Dr` (39+21 beds≥2, high HOA ~$1,065–$1,327)
   - **Laketown Wharf** — `9860 S Thomas Dr` (~32) — prior 9.0% reject; siblings only if lower price/HOA
   - **520 N Richard Jackson Blvd** (~26) — demoted volume filler, high HOA ~$1,254
   - **Skip / demote:** `15100 Front Beach` (med HOA ~$1,261); `9850 S Thomas` (all 1BR); Grand Panama `5115 Gulf Dr` last
3. Review ≥40 condo listings; aim for ≥3 new RESEARCH (SCREENED) candidates.
4. Log rejects to `data/reviewed/listings.ndjson`.

**Phase B — Tampa + Jacksonville seed buildings (P0, parallel):**

Manual condo-building search using `seed_buildings` in `data/search-criteria.json` until TASK-015 lands. Do not stop at seed list — broaden to market condo filter.

**Phase C — Birmingham, Memphis, Cleveland (P1):**

Condo-only sweeps after Phase A/B progress, or immediately when TASK-015 scrapes arrive. Use `seed_buildings` for these markets.

**Do not expand international** until US ACTIVE markets meet volume targets or dry-market notes exist for each.

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
7. **Prefer markets with bulk scrapes** — PCB first in `market_sweep_order` until inventory is exhausted or targets met.

### Yield screening

- Gross yield must be ≥ 10% to pass to RESEARCH.
- For condos with stated HOA, also compute quick adjusted yield: `(monthly_rent - hoa_monthly) * 12 / price`. Flag if below 8% even when gross yield passes.
- HOA over $500/month requires extra scrutiny (do not auto-reject, but note risk).
- **Lesson from Laketown Wharf:** 19% gross can still fail underwriting after HOA + STR management — prefer units with lower HOA or stronger LTR comps when choosing among sibling units.

### Volume targets

| Metric | Target |
|--------|--------|
| Listings reviewed per market | ≥ 40 |
| Research candidates total (US ACTIVE) | ≥ 10 |
| Research candidates per market | ≥ 3 |

**Do not stop early.** Continue scanning until targets are met or document dry-market rationale in scout_notes / commit message.

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

- [ ] All 6 US ACTIVE markets searched with condo filter first (or dry-market note per market)
- [ ] PCB: ≥40 condo listings reviewed from existing scrape; ≥3 new RESEARCH or documented shortfall
- [ ] Volume targets met or documented shortfall with dry-market rationale per market
- [ ] Each RESEARCH candidate has complete `meta.json` per schema
- [ ] Building name and unit recorded when available
- [ ] HOA > $500/month flagged in `scout_notes`
- [ ] Rejects logged to `data/reviewed/listings.ndjson`
- [ ] No new international RESEARCH until US targets met

## Depends on

- `data/search-criteria.json` v7
- `data/pipeline-status.json` — current gap snapshot
- `schemas/property-meta.json`, `schemas/reviewed-listing.json`
- PCB scrape available now; other markets accelerated by TASK-015

## Notes

Prior PCB RESEARCH units underwrote below 10% after expenses — keep scanning sibling units at better price/HOA points; prefer lower-HOA **beds≥2** clusters first (8700 Front Beach, then careful Horizon South siblings). Celebration FL remains WATCH — do not prioritize over ACTIVE markets. Fort Walton Beach / St Augustine scrapes exist but stay WATCH until ACTIVE volume targets are met. TASK-015 (Builder P0) adds bulk scrapes for the five zero-coverage US ACTIVE markets.
