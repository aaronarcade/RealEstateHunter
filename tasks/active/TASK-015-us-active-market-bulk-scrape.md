# TASK-015: US ACTIVE market bulk scrape (Scout volume unblock)

**Status:** ACTIVE  
**Assignee:** Builder  
**Priority:** P0

## Manager triage (2026-08-20)

**Scripts/CI merged (#44). Remaining deliverable: commit scrape JSON files to `data/scrapes/` on main.**

| Item | Status |
|------|--------|
| Multi-state Redfin scrape scripts | ✅ Merged (#44) |
| `scrape-us-active-markets.mjs` + tests | ✅ |
| Region IDs documented in `data/scrapes/README.md` | ✅ |
| `workflow_dispatch` scrape workflow | ✅ (uploads artifacts only) |
| `data/scrapes/{market}-active-listings-*.json` on main | ❌ **Still missing for all 5 markets** |

Scout (TASK-009) continues PCB Phase A and Tampa/Jax seed-building search without these files. This task unblocks full 40+/market volume on Tampa, Jacksonville, Birmingham, Memphis, and Cleveland.

### Remaining Builder work (do this now)

1. Run `workflow_dispatch` on `scrape-us-active-markets.yml` **or** locally: `node scripts/scrape-us-active-markets.mjs --date 2026-08-20`.
2. Place outputs under `data/scrapes/` as:
   - `tampa-fl-active-listings-YYYY-MM-DD.json`
   - `jacksonville-fl-active-listings-YYYY-MM-DD.json`
   - `birmingham-al-active-listings-YYYY-MM-DD.json`
   - `memphis-tn-active-listings-YYYY-MM-DD.json`
   - `cleveland-oh-active-listings-YYYY-MM-DD.json`
3. Commit and push to main (or Builder PR that lands the files).
4. Confirm each file has ≥100 listings (or document dry-market in commit notes).
5. Optional: `--condo-only` variant if full-market pull is too large — Scout filters condo anyway.

Do **not** scrape new international markets. Do **not** expand Fort Walton Beach or St Augustine until ACTIVE US volume targets are met.

## Description

Bulk-scrape active for-sale listings for the five US ACTIVE markets with **zero scout coverage** so Scout can meet volume targets (40+ listings reviewed per market) without manual one-by-one search.

Only Panama City Beach currently has a bulk scrape among ACTIVE markets (`data/scrapes/panama-city-beach-fl-active-listings-2026-08-10.json`, 2,700 listings / ~1,074 condos / ~574 beds≥2 in price band). Tampa, Jacksonville, Birmingham, Memphis, and Cleveland have none on disk yet.

## Markets to scrape

| Market ID | City | State | Priority |
|-----------|------|-------|----------|
| `tampa-fl` | Tampa | FL | P0 |
| `jacksonville-fl` | Jacksonville | FL | P0 |
| `birmingham-al` | Birmingham | AL | P1 |
| `memphis-tn` | Memphis | TN | P1 |
| `cleveland-oh` | Cleveland | OH | P1 |

## Acceptance criteria

- [x] Extend `scripts/scrape-redfin-market.mjs` (or add `scripts/scrape-us-active-markets.mjs`) to support multi-state US markets (currently FL-only in `mapHome`)
- [x] Output JSON per market under `data/scrapes/{market-id}-active-listings-YYYY-MM-DD.json` matching existing schema (`source`, `market`, `scraped_at`, `count`, `listings[]`)
- [x] Each listing includes: `address`, `asking_price`, `beds`, `baths`, `property_type`, `hoa_monthly` (when available), `mls_id`, `listing_url`, `state`
- [x] Condo filter optional flag (`--condo-only`) for Scout-focused pulls
- [x] Document Redfin region IDs used per market in script comments or `data/scrapes/README.md`
- [x] Sync script (`scripts/sync-market-listings-to-supabase.mjs`) works with new files
- [ ] **Smoke test:** each market file committed under `data/scrapes/` with ≥100 listings (or document dry-market if fewer)

## Reference

- Existing FL scraper: `scripts/scrape-redfin-market.mjs`
- PCB output: `data/scrapes/panama-city-beach-fl-active-listings-2026-08-10.json`
- Wave 2 international pattern: `scripts/scrape-wave2-yield-cities.mjs`
- Workflow: `.github/workflows/scrape-us-active-markets.yml` (artifact upload — files must still be committed)

## Scout usage

After scrape files land on main, Scout (TASK-009) filters `property_type: "condo"`, applies yield screen (≥10% gross), and logs rejects to `data/reviewed/listings.ndjson`. RESEARCH candidates get full `data/properties/{id}/` dirs.

## Depends on

- `schemas/market-listing.json`
- TASK-007 (Supabase sync — complete)

## Blocks

- TASK-009 Scout volume sweep Phases B–C at full volume (Tampa/Jacksonville/Birmingham/Memphis/Cleveland)

## Notes

PCB is **not** blocked — Scout should process the existing PCB scrape in parallel. This task unblocks the other five ACTIVE markets only. WATCH-market scrapes (FWB, St Augustine, international) are out of scope. Builder PR #44 shipped scripts; Manager will move this task to `tasks/done/` only after scrape JSON files are on main.
