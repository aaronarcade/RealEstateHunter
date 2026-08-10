# RealEstateHunter Streamlit UI

Password-protected Streamlit app for comparing investment opportunities. Mirrors the React UI in `ui/` and follows styling patterns from [RealEstateTracker](https://github.com/aaronarcade/RealEstateTracker).

## Run locally

```bash
cd streamlit
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure secrets (copy example and edit)
cp ../.streamlit/secrets.toml.example ../.streamlit/secrets.toml

streamlit run app.py
```

Or from the repo root:

```bash
streamlit run streamlit/app.py
```

## Secrets

Create `.streamlit/secrets.toml` (gitignored) with:

| Key | Purpose |
|-----|---------|
| `APP_PASSWORD` | Shared login password (required) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side reads (preferred) |
| `SUPABASE_ANON_KEY` | Optional fallback if RLS allows reads |

See `.streamlit/secrets.toml.example`.

Without Supabase credentials the app falls back to sample data after login.

## Features

- Password gate before any listing data or links render
- Table and card views (React parity)
- Sorting: default ranking (status → confidence → cap rate → NOI) or column sort
- Field provenance indicators (VERIFIED / ESTIMATED / UNKNOWN)
- Status badges: VIABLE / WATCHLIST / REJECTED

## Streamlit Cloud

1. Deploy from a **private** GitHub repo.
2. Set app entry point: `streamlit/app.py`
3. Add secrets in the Streamlit Cloud dashboard (same keys as above).
4. Do not expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code.

## Tests

```bash
cd streamlit
pytest
```

Sorting tests mirror `ui/src/data/sorting.test.ts`.

## Data source

Production reads from the **shared RealEstateTracker Supabase project** — units via the `get_cap_rate_summary` RPC, enriched with `unit_financials` and `data_sources` for HOA, assessments, and listing URLs.

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`) in `.streamlit/secrets.toml`. Toggle **Use sample data** in the sidebar for offline dev.
