# TASK-015: US ACTIVE market bulk scrape (Scout volume unblock)

**Status:** BACKLOG  
**Assignee:** Builder  
**Priority:** P0

## Manager triage (2026-08-13)

**Elevated to P0.** Scout (TASK-009) can execute PCB immediately from the existing scrape, but Tampa, Jacksonville, Birmingham, Memphis, and Cleveland still have **zero** bulk inventory. Without this task, Scout cannot hit 40 listings/market on five of six US ACTIVE markets at scale.

Ship Phase A (Tampa + Jacksonville) first if sequencing is required; then Birmingham, Memphis, Cleveland.

Do **not** scrape new international markets until these five US files exist.

## Description

Bulk-scrape active for-sale listings for the five US ACTIVE markets with **zero scout coverage** so Scout can meet volume targets (40+ listings reviewed per market) without manual one-by-one search.

Only Panama City Beach currently has a bulk scrape (`data/scrapes/panama-city-beach-fl-active-listings-2026-08-10.json`, 2,700 listings / ~1,074 condos). Tampa, Jacksonville, Birmingham, Memphis, and Cleveland have none.

## Markets to scrape

| Market ID | City | State | Priority |
|-----------|------|-------|----------|
| `tampa-fl` | Tampa | FL | P0 |
| `jacksonville-fl` | Jacksonville | FL | P0 |
| `birmingham-al` | Birmingham | AL | P1 |
| `memphis-tn` | Memphis | TN | P1 |
| `cleveland-oh` | Cleveland | OH | P1 |

## Acceptance criteria

- [ ] Extend `scripts/scrape-redfin-market.mjs` (or add `scripts/scrape-us-active-markets.mjs`) to support multi-state US markets (currently FL-only in `mapHome`)
- [ ] Output JSON per market under `data/scrapes/{market-id}-active-listings-YYYY-MM-DD.json` matching existing schema (`source`, `market`, `scraped_at`, `count`, `listings[]`)
- [ ] Each listing includes: `address`, `asking_price`, `beds`, `baths`, `property_type`, `hoa_monthly` (when available), `mls_id`, `listing_url`, `state`
- [ ] Condo filter optional flag (`--condo-only`) for Scout-focused pulls
- [ ] Document Redfin region IDs used per market in script comments or `data/scrapes/README.md`
- [ ] Sync script (`scripts/sync-market-listings-to-supabase.mjs`) works with new files
- [ ] Smoke test: each market file has ≥100 listings (or document dry-market if fewer)

## Reference

- Existing FL scraper: `scripts/scrape-redfin-market.mjs`
- PCB output: `data/scrapes/panama-city-beach-fl-active-listings-2026-08-10.json`
- Wave 2 international pattern: `scripts/scrape-wave2-yield-cities.mjs`

## Scout usage

After scrape, Scout (TASK-009) filters `property_type: "condo"`, applies yield screen (≥10% gross), and logs rejects to `data/reviewed/listings.ndjson`. RESEARCH candidates get full `data/properties/{id}/` dirs.

## Depends on

- `schemas/market-listing.json`
- TASK-007 (Supabase sync — complete)

## Blocks

- TASK-009 Scout volume sweep Phases B–C at full volume (Tampa/Jacksonville/Birmingham/Memphis/Cleveland)

## Notes

PCB is **not** blocked — Scout should process the existing PCB scrape in parallel. This task unblocks the other five ACTIVE markets only.
