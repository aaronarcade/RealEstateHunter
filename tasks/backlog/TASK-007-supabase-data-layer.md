# TASK-007: Supabase data layer (UI source of truth)

**Status:** BACKLOG  
**Assignee:** Builder  
**Priority:** P0

## Description

Connect RealEstateHunter to the existing **Supabase** project as the **runtime data store** for UIs and dashboards. Git JSON under `data/properties/` remains the agent workflow artifact layer; Supabase holds the queryable copy agents and UIs use at runtime.

**Existing project:** `https://quvfkegqgbrvtmufndpn.supabase.co` (Aaron — tables already contain similar property data).

Do **not** commit credentials. Use environment variables / Streamlit secrets only.

## Architecture

```
Cloud Agents → PR → data/properties/{id}/*.json  (workflow / audit trail in Git)
                         ↓ sync (on publish or merge)
                   Supabase (properties, opportunities, …)
                         ↓ read
              React UI / Streamlit / future tools
```

| Layer | Role |
|-------|------|
| **Git JSON** | Agent handoffs, schema validation, PR review, orchestrator state |
| **Supabase** | Live reads for UI, filters, history, optional non-agent edits |
| **Sync** | One-way Git → Supabase when property reaches `RANKED` or `PUBLISHED` (v1) |

## Phase 1 — Discovery & mapping (required first)

- [ ] Introspect existing Supabase schema (tables, columns, RLS policies) via dashboard or `supabase db dump --schema-only`
- [ ] Add `docs/SUPABASE.md` documenting:
  - Table → artifact mapping (`meta` / `evidence` / `underwriting` / `audit` → rows or JSONB columns)
  - Gaps vs `schemas/property-*.json` and `PropertyOpportunity`
  - Whether to **adapt to existing tables** or add migration for missing columns
- [ ] Record project URL in docs only — **no keys in repo**

Aaron to provide (via GitHub secrets / local `.env`, not chat):

- `SUPABASE_URL` — `https://quvfkegqgbrvtmufndpn.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — server-side sync only (GitHub Actions, Streamlit backend)
- `SUPABASE_ANON_KEY` — optional client read if RLS allows

## Phase 2 — Read clients

- [ ] `.env.example` at repo root with required vars
- [ ] `lib/supabase/` or `scripts/supabase/` — TypeScript read client: `listOpportunities()`, `getProperty(id)`
- [ ] Python mirror under `streamlit/supabase/` or shared package for Streamlit (TASK-006)
- [ ] Map Supabase rows → `PropertyOpportunity` shape (`schemas/property-opportunity.json`)
- [ ] Tests with mocked Supabase responses (no live DB in CI)

## Phase 3 — Sync Git → Supabase

- [ ] `scripts/sync-properties-to-supabase.mjs` (or similar):
  - Scan `data/properties/*/`
  - Upsert properties with `workflow_state` in `RANKED`, `PUBLISHED`, or audit `PASS`
  - Idempotent on `property_id` / slug
- [ ] Optional GitHub Action: run sync on push to `main` when `data/properties/**` changes (after orchestrator merge)
- [ ] Log sync results; fail CI on schema mismatch

## Acceptance criteria

- [ ] Documented schema mapping in `docs/SUPABASE.md`
- [ ] ADR accepted in `docs/DECISIONS.md` (Supabase as UI DB, Git as agent artifacts)
- [ ] Read client works against Aaron's existing data (manual verification)
- [ ] Sync script pushes at least `_example` property shape correctly
- [ ] No secrets committed; `.env` and `.streamlit/secrets.toml` gitignored
- [ ] RLS documented: who can read/write (service role for sync, authenticated or anon+RLS for UI)

## Depends on

- TASK-001 (property schemas)
- Access to Supabase dashboard or service role key for discovery

## Blocks

- TASK-006 (Streamlit) — should read Supabase, not Git files
- Future React UI live-data task — same read client

## Notes

- Prefer **matching existing Supabase tables** over greenfield schema if data is already populated.
- If existing schema differs significantly, propose minimal migration SQL in `supabase/migrations/` (Supabase CLI).
- Scout/archived rejects can stay Git-only until promoted; sync only publishable rows to limit noise.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to Streamlit frontend or browser React bundle.
