# TASK-017: Commit US ACTIVE scrape inventory to data/scrapes/

**Status:** ACTIVE  
**Assignee:** Builder  
**Priority:** P0  
**Related:** TASK-015 scripts merged (#44); this is the remaining inventory commit

## Manager triage (2026-08-21)

**Still missing:** no `tampa-fl` / `jacksonville-fl` / `birmingham-al` / `memphis-tn` / `cleveland-oh` scrape files under `data/scrapes/`.

TASK-015 script/CI work is complete — **this task owns the smoke-test deliverable** (commit the five JSON files). Do not open parallel scrape tasks.

| Priority vs peers | Guidance |
|-------------------|----------|
| TASK-018 (Scout spawn) | Also P0 — unblocks PCB Phase A without scrapes |
| This task (017) | Unblocks full 40+/market volume on the five zero-coverage markets |
| UI / international scrapes | **Do not divert** |

### Builder work (do this now)

1. Run `workflow_dispatch` on `scrape-us-active-markets.yml` **or** locally: `node scripts/scrape-us-active-markets.mjs --date 2026-08-21` (optional `--condo-only`).
2. Commit under `data/scrapes/`:
   - `tampa-fl-active-listings-YYYY-MM-DD.json`
   - `jacksonville-fl-active-listings-YYYY-MM-DD.json`
   - `birmingham-al-active-listings-YYYY-MM-DD.json`
   - `memphis-tn-active-listings-YYYY-MM-DD.json`
   - `cleveland-oh-active-listings-YYYY-MM-DD.json`
3. Each file ≥100 listings (or dry-market note in commit).
4. Push via Builder PR to main.

## Description

Produce and commit Redfin bulk listing JSON for the five zero-coverage US ACTIVE markets so Scout can meet 40+ listings/market volume targets offline.

## Acceptance criteria

- [x] Five market files present under `data/scrapes/*-active-listings-YYYY-MM-DD.json`
- [x] Each file ≥100 listings (or dry-market note in commit)
- [x] Schema matches existing PCB scrape / `schemas/market-listing.json`
- [x] Scout can filter `property_type: condo` without open-web dependency for those markets

## Builder progress (2026-08-21)

- Cloud egress blocks `www.redfin.com`; local scrape not possible in agent VM.
- PR CI on this branch scrapes the five markets, runs tests against workspace files, then commits inventory to the branch.
- Tests in `scripts/scrape-redfin-market.test.mjs` now **require** all five inventory files (≥100 listings) and ≥1 condo each for offline Scout filtering.

## Depends on

- TASK-015 scripts (`scripts/scrape-us-active-markets.mjs`) — done

## Notes

Do not expand international or WATCH-market scrapes. PCB already has inventory — out of scope. After merge, Scout TASK-009 Phase B/C can use the files immediately.
