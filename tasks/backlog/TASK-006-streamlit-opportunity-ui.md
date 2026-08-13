# TASK-006: Streamlit opportunity comparison UI (React parity)

**Status:** BACKLOG  
**Assignee:** Builder  
**Priority:** P3

## Manager triage (2026-08-13)

**Remains P3.** Streamlit app is largely built (`streamlit/app.py` with auth, Opportunities, Reviewed, Market Research, Building, and Unit pages). Remaining work is React parity gaps (table/card toggle, field provenance display). Do not start until TASK-015 (P0) ships — Scout volume unblock is the Builder priority.

## Description

Build a **duplicate** of the existing React opportunity comparison UI (`ui/`) using **Streamlit**, for faster local iteration and optional lightweight deployment (Streamlit Community Cloud, internal server, etc.).

The Streamlit app must present the same investment comparison surface as the Vite + React UI — not a new product design. Investment rules and ranking logic come from `docs/PRODUCT.md`; data contract from `schemas/property-opportunity.json` and `docs/ARCHITECTURE.md`.

**This app will expose investment analysis — it must be password-protected before any data is shown.**

## Where data lives

**Runtime (UI):** Aaron's **Supabase** project — see TASK-007 and `docs/SUPABASE.md` (after mapping).

**Agent workflow (Git):** JSON under `data/properties/{id}/` — synced to Supabase when ranked/published.

| Layer | Purpose |
|-------|---------|
| Git JSON | Agents, PR review, orchestrator, audit trail |
| Supabase | Streamlit + React reads; queryable live data |

Streamlit loads from **Supabase**, not repo files, in production.

## Reference implementation

Mirror behavior from:

| React (source of truth) | Replicate in Streamlit |
|-------------------------|-------------------------|
| `ui/src/App.tsx` | Page layout, table/card toggle |
| `ui/src/components/OpportunityTable.tsx` | Sortable table view |
| `ui/src/components/OpportunityCard.tsx` | Card grid view |
| `ui/src/components/StatusBadge.tsx`, `ConfidenceBadge.tsx`, `FieldValueDisplay.tsx` | Status/confidence/field provenance display |
| `ui/src/data/loader.ts` | Map Supabase rows → `PropertyOpportunity` (via TASK-007) |
| `ui/src/data/sorting.ts` | Default + column sort ranking rules |

## Acceptance criteria

### UI parity

- [ ] New app directory: `streamlit/` with `app.py`, `requirements.txt`, and README
- [ ] **Table view** with columns: property, location, price, rent, NOI, cap rate, HOA, assessments, confidence, status, listing link
- [ ] **Card view** toggle (Streamlit tabs, radio, or sidebar) equivalent to React table/card switch
- [ ] **Sorting** matches `ui/src/data/sorting.ts`:
  - Default: status → confidence → cap rate (desc) → NOI (desc)
  - User-selectable column sort with direction toggle where applicable
- [ ] **Visual distinction** for VIABLE / WATCHLIST / REJECTED (color or badge)
- [ ] **Field provenance**: show VERIFIED / ESTIMATED / UNKNOWN and confidence on price, rent, HOA, assessment where present
- [ ] **Data source**: load opportunities from **Supabase** (TASK-007 client); filter to publishable statuses; sample-data fallback only for local dev without credentials
- [ ] **No investment logic in UI** — display pipeline output only
- [ ] Tests for sorting/loader parity (pytest or shared test vectors from `ui/src/data/sorting.test.ts`)
- [ ] Document run command: `streamlit run streamlit/app.py`

### Password protection (required)

- [ ] **Login gate** before any opportunity data or listing links render
- [ ] Password from environment / secrets — **never hardcoded or committed**:
  - Local: `.streamlit/secrets.toml` (gitignored): `APP_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - Streamlit Cloud: same keys in app secrets dashboard
- [ ] Provide `.streamlit/secrets.toml.example` with placeholder keys
- [ ] Session persists after login (`st.session_state`); logout control in sidebar
- [ ] Failed login shows generic error (no password hints)
- [ ] README documents setup for local secrets and Streamlit Cloud deployment with **private GitHub repo** recommended

Suggested pattern (Builder may adjust):

```python
# streamlit/auth.py — check st.session_state["authenticated"]
# Compare st.secrets["APP_PASSWORD"] to user input via st.text_input(type="password")
```

Optional: `streamlit-authenticator` if multi-user needed later; single shared password is enough for v1.

## Out of scope (for this task)

- Replacing or removing the React `ui/` app
- New fields not in `PropertyOpportunity`
- Write-back to property records or agent orchestration
- External database setup — covered by **TASK-007** (Streamlit consumes it)

## Depends on

- TASK-001 (property schema) — merged
- TASK-002 (React UI) — layout/sorting reference
- **TASK-007 (Supabase data layer)** — **complete**

## Suggested layout

```
streamlit/
├── app.py
├── auth.py
├── requirements.txt
├── README.md
├── supabase_client.py      # read opportunities (TASK-007 mapping)
├── sorting.py
└── tests/
.streamlit/
├── config.toml
└── secrets.toml.example    # APP_PASSWORD, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

## Notes

- **Private repo + password + Supabase RLS** — do not expose service role key to the browser
- Keep ranking rules in sync with React — shared test fixtures recommended.
- Python 3.11+ recommended.
