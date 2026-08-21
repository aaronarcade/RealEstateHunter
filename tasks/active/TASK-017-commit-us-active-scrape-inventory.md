# TASK-017: Commit US ACTIVE scrape inventory to data/scrapes/

**Status:** BACKLOG (activate if Builder prefers a follow-on branch after TASK-015 scripts)  
**Assignee:** Builder  
**Priority:** P0  
**Related:** TASK-015 (scripts merged #44; this tracks the missing inventory files)

## Manager triage (2026-08-20)

TASK-015 acceptance still open on smoke test because **no** `tampa-fl` / `jacksonville-fl` / `birmingham-al` / `memphis-tn` / `cleveland-oh` scrape files exist under `data/scrapes/`. CI `workflow_dispatch` uploads artifacts but does not commit them.

Prefer completing remaining work on **TASK-015** itself. Use this task only if TASK-015 is closed for scripts-only and inventory commit needs a separate Builder spawn.

## Description

Produce and commit Redfin bulk listing JSON for the five zero-coverage US ACTIVE markets so Scout can meet 40+ listings/market volume targets offline.

## Acceptance criteria

- [ ] Five market files present under `data/scrapes/*-active-listings-YYYY-MM-DD.json`
- [ ] Each file ≥100 listings (or dry-market note in commit)
- [ ] Schema matches existing PCB scrape / `schemas/market-listing.json`
- [ ] Scout can filter `property_type: condo` without open-web dependency for those markets

## Depends on

- TASK-015 scripts (`scripts/scrape-us-active-markets.mjs`)

## Notes

Do not expand international or WATCH-market scrapes. PCB already has inventory — out of scope.
