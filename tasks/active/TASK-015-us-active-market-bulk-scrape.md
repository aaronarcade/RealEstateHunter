# TASK-015: US ACTIVE market bulk scrape (Scout volume unblock)

**Status:** ACTIVE  
**Assignee:** Builder  
**Priority:** P0

## Manager triage (2026-08-15)

**Remains P0 — still the Builder unblock for five zero-coverage ACTIVE markets.**

Scout (TASK-009) can execute PCB immediately from the existing scrape, but Tampa, Jacksonville, Birmingham, Memphis, and Cleveland still have **zero** bulk inventory. Without this task, Scout cannot hit 40 listings/market on five of six US ACTIVE markets at scale.

Ship Phase A (Tampa + Jacksonville) first if sequencing is required; then Birmingham, Memphis, Cleveland.

Do **not** scrape new international markets. Do **not** expand Fort Walton Beach or St Augustine (WATCH scrapes already exist) until ACTIVE US targets are met.

## Description

Bulk-scrape active for-sale listings for the five US ACTIVE markets with **zero scout coverage** so Scout can meet volume targets (40+ listings reviewed per market) without manual one-by-one search.

Only Panama City Beach currently has a bulk scrape among ACTIVE markets (`data/scrapes/panama-city-beach-fl-active-listings-2026-08-10.json`, 2,700 listings / ~1,074 condos / ~574 beds≥2 in price band). Tampa, Jacksonville, Birmingham, Memphis, and Cleveland have none.

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
- [ ] Output JSON per market under `data/scrapes/{market-id}-active-listings-YYYY-MM-DD.json` matching existing schema (`source`, `market`, `scraped_at`, `count`, `listings[]`) — pending live Redfin egress
- [x] Each listing includes: `address`, `asking_price`, `beds`, `baths`, `property_type`, `hoa_monthly` (when available), `mls_id`, `listing_url`, `state`
- [x] Condo filter optional flag (`--condo-only`) for Scout-focused pulls
- [x] Document Redfin region IDs used per market in script comments or `data/scrapes/README.md`
- [x] Sync script (`scripts/sync-market-listings-to-supabase.mjs`) works with new files
- [ ] Smoke test: each market file has ≥100 listings (or document dry-market if fewer) — pending live Redfin egress

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

PCB is **not** blocked — Scout should process the existing PCB scrape in parallel. This task unblocks the other five ACTIVE markets only. WATCH-market scrapes (FWB, St Augustine, international) are out of scope.

### Builder progress (2026-08-16)

- Multi-state + `--condo-only` in `scripts/lib/redfin-market.mjs` / `scripts/scrape-redfin-market.mjs`
- Orchestrator: `scripts/scrape-us-active-markets.mjs` (Phase A/B, `--market`, `--condo-only`)
- Region IDs documented in `data/scrapes/README.md`
- Schema + sync/verify + Streamlit `MARKET_ID_BY_AREA` updated for tampa/jacksonville/birmingham/memphis/cleveland
- Unit tests in `scripts/scrape-redfin-market.test.mjs` (`npm test` green)
- **Blocked on live scrape:** Cloud egress allowlist must include `www.redfin.com` (requested via environment setup; `ECONNRESET` today)
