# TASK-015: US ACTIVE market bulk scrape (Scout volume unblock)

**Status:** ACTIVE  
**Assignee:** Builder  
**Priority:** P1

## Description

Bulk-scrape active for-sale listings for the five US ACTIVE markets with **zero scout coverage** so Scout can meet volume targets (40+ listings reviewed per market) without manual one-by-one search.

Only Panama City Beach currently has a bulk scrape (`data/scrapes/panama-city-beach-fl-active-listings-2026-08-10.json`, 2,700 listings). Tampa, Jacksonville, Birmingham, Memphis, and Cleveland have none.

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
- [ ] Output JSON per market under `data/scrapes/{market-id}-active-listings-YYYY-MM-DD.json` matching existing schema (`source`, `market`, `scraped_at`, `count`, `listings[]`) — **blocked on Cloud egress to `www.redfin.com`** (allowlist requested); run `node scripts/scrape-us-active-markets.mjs` once allowed
- [x] Each listing includes: `address`, `asking_price`, `beds`, `baths`, `property_type`, `hoa_monthly` (when available), `mls_id`, `listing_url`, `state` (enforced by mapper + smoke script)
- [x] Condo filter optional flag (`--condo-only`) for Scout-focused pulls
- [x] Document Redfin region IDs used per market in script comments or `data/scrapes/README.md`
- [x] Sync script (`scripts/sync-market-listings-to-supabase.mjs`) works with new files (`market_area` enum + `MARKET_ID_BY_AREA`; `--us-only` is all-US, not FL-only)
- [ ] Smoke test: each market file has ≥100 listings (or document dry-market if fewer) — run `node scripts/smoke-us-active-scrapes.mjs` after scrape

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

- TASK-009 Scout volume sweep (Phase A Tampa/Jacksonville, Phase B Birmingham/Memphis/Cleveland)

## Notes

Manager triage (2026-08-12): This is the top Builder priority. Scout cannot meet 40 listings/market targets on five zero-coverage markets without bulk inventory. Do not scrape new international markets until US ACTIVE targets are met.
