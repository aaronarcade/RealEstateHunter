# TASK-013: Reviewed Listings Page (Streamlit)

**Status:** DONE  
**Branch:** `agent/task-013-reviewed-listings-page`

## Goal

Add a lightweight reviewed-listings data tier and Streamlit browse page for scout-scanned properties with source links, city/country tags, price, and estimated cap rates — without bloating the full `properties` pipeline.

## Acceptance criteria

- [x] `schemas/reviewed-listing.json` and `data/reviewed/listings.ndjson`
- [x] `lib/property` `ReviewedListingStore` helper with validation
- [x] Supabase migration `002_reviewed_listings.sql` and sync script
- [x] Scout prompts: REJECT → NDJSON only; RESEARCH → full property dir
- [x] Backfill from ARCHIVED meta + screening log
- [x] Streamlit Browse → Reviewed page with filters and analytics summary
- [x] Tests and docs (ARCHITECTURE, SUPABASE, ADR-010)

## Verify

```bash
cd lib/property && npm test
npm test
node scripts/validate.mjs
cd streamlit && python -m pytest tests/test_reviewed_filters.py
node scripts/sync-reviewed-to-supabase.mjs --dry-run  # requires SUPABASE_* env
```
