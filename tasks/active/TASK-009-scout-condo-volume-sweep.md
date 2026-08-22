# TASK-009: Scout condo building volume sweep

**Status:** ACTIVE  
**Assignee:** Scout  
**Priority:** P0

## Manager triage (2026-08-22)

**Still the critical path. No Scout volume progress since 2026-08-13 (NDJSON still 47; open US RESEARCH/SCREENED = 0).**

**TASK-017 DONE:** All five zero-coverage US ACTIVE markets now have scrape files on main (2026-08-21). Scout can run full 40+/market offline sweeps on every US ACTIVE market without waiting for open-web scrapes.

**Blocker unchanged:** Orchestrator does not spawn Scout for this task (TASK-018 in flight). Scout agents must execute this file when spawned manually until 018 lands.

| Market | Priority | Listings Reviewed | RESEARCH open | Target | Bulk Scrape |
|--------|----------|-------------------|---------------|--------|-------------|
| Panama City Beach, FL | 3 | 5 | 0 (2 archived) | 40 / 3 | ✅ **1,074 condos** (~574 beds≥2 in band) |
| Tampa, FL | 1 | 0 | 0 | 40 / 3 | ✅ **749 condos** (~428 beds≥2) — `tampa-fl-active-listings-2026-08-21.json` |
| Jacksonville, FL | 2 | 0 | 0 | 40 / 3 | ✅ **523 condos** (~440 beds≥2) — `jacksonville-fl-active-listings-2026-08-21.json` |
| Birmingham, AL | 4 | 0 | 0 | 40 / 3 | ✅ **198 condos** (~116 beds≥2) — sparse HOA in scrape |
| Memphis, TN | 5 | 0 | 0 | 40 / 3 | ✅ **307 condos** (~206 beds≥2) — HOA not in scrape |
| Cleveland, OH | 6 | 0 | 0 | 40 / 3 | ✅ **64 condos** (~48 beds≥2) — thin market |

**Total reviewed (NDJSON):** 47 — 39 Manta EC rejects, 6 US (5 PCB + 1 Celebration), 2 Cuenca. **Open US ACTIVE RESEARCH = 0.**

International Analyst/Auditor work is **parked** (13 properties archived 2026-08-21). Do not add new international RESEARCH.

### Execute immediately (all scrapes available)

**Phase A — Panama City Beach scrape (P0, unblocked):**

1. Filter `data/scrapes/panama-city-beach-fl-active-listings-2026-08-10.json` for `property_type: "condo"`, **`beds >= 2`**, price `$75k–$750k`.
2. Building clusters in **beds≥2 median-HOA order** (see `search-criteria.json` `seed_buildings`):
   - **8700 Front Beach Rd** (~16 beds≥2) — median HOA ~$672 (**START HERE**)
   - **Horizon South** — `17462 Front Beach Rd` (~16 beds≥2) — med HOA ~$631; Unit 31C REJECTED 6.0%; siblings only if better ask/rent
   - **14415 Front Beach Rd** (~6) — med HOA ~$887 (new mid-HOA filler)
   - **11807 Front Beach Rd** (~15) — median HOA ~$839
   - **16819 Front Beach Rd** (~17) — median HOA ~$978
   - **Shores of Panama** — `9900` + `9902 S Thomas Dr` (40+21 beds≥2, high HOA)
   - **Laketown Wharf** — `9860 S Thomas Dr` (~33) — prior 9.0% reject; siblings only if lower price/HOA
   - **520 N Richard Jackson Blvd** (~26) — demoted volume filler
   - **Skip / demote:** `15100 Front Beach`; `9850 S Thomas` (1BR); Grand Panama / Gulf Dr last
3. Review ≥40 condo listings; aim for ≥3 new RESEARCH (SCREENED) candidates.
4. Log rejects to `data/reviewed/listings.ndjson`.
5. Commit in batches of ~10 reviews — do not hold an entire market for one commit.

**Phase B — Tampa + Jacksonville scrapes (P0, parallel with Phase A):**

Filter `data/scrapes/tampa-fl-active-listings-2026-08-21.json` and `jacksonville-fl-active-listings-2026-08-21.json` for condo, beds≥2, price band. Start seed clusters in `search-criteria.json` v10:

- Tampa: **18001 Richmond Place Dr** → 501 Knights Run → 9481 Highland Oak
- Jacksonville: **10961 Burnt Mill Rd** → 9745/8550 Touchton Rd → 7701 Baymeadows

Review ≥40 listings per market; aim ≥3 RESEARCH each.

**Phase C — Birmingham, Memphis, Cleveland (P1):**

Use TASK-017 scrape files (`birmingham-al`, `memphis-tn`, `cleveland-oh` dated 2026-08-21). Memphis/Birmingham need off-scrape HOA lookup. Cleveland may qualify as dry-market if <3 RESEARCH after full 48-listing condo sweep.

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

- `data/search-criteria.json` v10
- `data/pipeline-status.json` — current gap snapshot
- `schemas/property-meta.json`, `schemas/reviewed-listing.json`
- All six US ACTIVE scrape files on main (TASK-017 done 2026-08-21)
- TASK-018 for autonomous Scout spawn (software); this task remains executable when a Scout agent is running

## Notes

Prior PCB RESEARCH units underwrote below 10% after expenses — keep scanning sibling units at better price/HOA points; prefer lower-HOA **beds≥2** clusters first (8700 Front Beach, then careful Horizon South siblings). Celebration FL remains WATCH — do not prioritize over ACTIVE markets. Fort Walton Beach / St Augustine scrapes exist but stay WATCH until ACTIVE volume targets are met.
