# TASK-015: US ACTIVE market bulk scrape (Scout volume unblock)

**Status:** DONE (scripts/CI)  
**Assignee:** Builder  
**Priority:** P0

## Manager closeout (2026-08-21)

Scripts, multi-state Redfin support, tests, README region IDs, and `workflow_dispatch` workflow merged (#44). **Remaining inventory commit tracked by TASK-017** (five market JSON files still absent from `data/scrapes/`).

| Item | Status |
|------|--------|
| Multi-state Redfin scrape scripts | ✅ Merged (#44) |
| `scrape-us-active-markets.mjs` + tests | ✅ |
| Region IDs documented in `data/scrapes/README.md` | ✅ |
| `workflow_dispatch` scrape workflow | ✅ (uploads artifacts only) |
| `data/scrapes/{market}-active-listings-*.json` on main | → **TASK-017** |

## Description

Bulk-scrape active for-sale listings for the five US ACTIVE markets with zero scout coverage so Scout can meet volume targets (40+ listings reviewed per market) without manual one-by-one search.

## Markets to scrape

| Market ID | City | State | Priority |
|-----------|------|-------|----------|
| `tampa-fl` | Tampa | FL | P0 |
| `jacksonville-fl` | Jacksonville | FL | P0 |
| `birmingham-al` | Birmingham | AL | P1 |
| `memphis-tn` | Memphis | TN | P1 |
| `cleveland-oh` | Cleveland | OH | P1 |

## Acceptance criteria

- [x] Extend `scripts/scrape-redfin-market.mjs` (or add `scripts/scrape-us-active-markets.mjs`) to support multi-state US markets
- [x] Output JSON per market under `data/scrapes/{market-id}-active-listings-YYYY-MM-DD.json` matching existing schema
- [x] Each listing includes: `address`, `asking_price`, `beds`, `baths`, `property_type`, `hoa_monthly` (when available), `mls_id`, `listing_url`, `state`
- [x] Condo filter optional flag (`--condo-only`) for Scout-focused pulls
- [x] Document Redfin region IDs used per market in script comments or `data/scrapes/README.md`
- [x] Sync script works with new files
- [ ] Smoke test: each market file committed — **moved to TASK-017**

## Notes

PCB was never blocked. WATCH-market scrapes out of scope. Follow-on: TASK-017.
