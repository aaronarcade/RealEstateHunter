# TASK-008: Wire React UI to Supabase

**Status:** DONE  
**Assignee:** Builder  
**Priority:** P1

## Description

Replace hardcoded sample data in `ui/` with live opportunities loaded from **Supabase** via the read client built in TASK-007.

## Acceptance criteria

- [x] Remove `useSampleData: true` default from `App.tsx`
- [x] `fetchOpportunities()` calls Supabase (or repo API that reads Supabase) — not `/data/opportunities.json`
- [x] Sample data fallback **only** when Supabase returns empty and `VITE_USE_SAMPLE_DATA=true`
- [x] Env vars documented: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon key only — never service role in browser)
- [x] Loading and error states preserved
- [x] Tests updated (mock Supabase client)
- [x] `ui/README.md` documents local setup with `.env`

## Depends on

- TASK-007 (Supabase read client + schema mapping)

## Notes

Git `data/properties/` remains source for agents; UI reads Supabase after sync.

## Implementation Notes

- Added browser Supabase client in `ui/src/data/supabase.ts`
- Modified `ui/src/data/loader.ts` to call Supabase via `fetchOpportunitiesFromSupabase()`
- Updated `useOpportunities` hook with `isSampleDataEnabled()` check for fallback logic
- Added comprehensive tests in `ui/src/data/supabase.test.ts`
- Updated `ui/README.md` with full environment variable documentation and setup instructions
