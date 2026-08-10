# TASK-008: Wire React UI to Supabase

**Status:** BACKLOG  
**Assignee:** Builder  
**Priority:** P1

## Description

Replace hardcoded sample data in `ui/` with live opportunities loaded from **Supabase** via the read client built in TASK-007.

## Acceptance criteria

- [ ] Remove `useSampleData: true` default from `App.tsx`
- [ ] `fetchOpportunities()` calls Supabase (or repo API that reads Supabase) — not `/data/opportunities.json`
- [ ] Sample data fallback **only** when Supabase returns empty and `VITE_USE_SAMPLE_DATA=true`
- [ ] Env vars documented: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon key only — never service role in browser)
- [ ] Loading and error states preserved
- [ ] Tests updated (mock Supabase client)
- [ ] `ui/README.md` documents local setup with `.env`

## Depends on

- TASK-007 (Supabase read client + schema mapping)

## Notes

Git `data/properties/` remains source for agents; UI reads Supabase after sync.
