# Supabase Integration

RealEstateHunter uses Supabase as the runtime data store for UIs and dashboards. Git JSON under `data/properties/` remains the agent workflow artifact layer; Supabase holds the queryable copy that UIs read at runtime.

## Project

- **URL:** `https://quvfkegqgbrvtmufndpn.supabase.co`
- **Dashboard:** Access via Aaron's Supabase account

**Credentials are NOT stored in the repository.** Use environment variables or Streamlit secrets.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Cloud Agents → PR → data/properties/{id}/*.json (workflow/audit trail)│
│                               ↓                                         │
│                     sync (on RANKED/PUBLISHED)                          │
│                               ↓                                         │
│                     ┌─────────────────┐                                 │
│                     │    Supabase     │                                 │
│                     │   (Postgres)    │                                 │
│                     └────────┬────────┘                                 │
│                              ↓                                          │
│               ┌──────────────┴──────────────┐                           │
│               │                             │                           │
│        React UI (anon key)         Streamlit (service role)             │
└─────────────────────────────────────────────────────────────────────────┘
```

| Layer | Role |
|-------|------|
| **Git JSON** | Agent handoffs, schema validation, PR review, orchestrator state |
| **Supabase** | Live reads for UI, filters, history, optional non-agent edits |
| **Sync** | One-way Git → Supabase when property reaches `RANKED` or `PUBLISHED` |

## Schema Mapping

### Primary Table: `properties`

The `properties` table stores the `PropertyOpportunity` shape for UI consumption.

| Column | Type | Maps From | Notes |
|--------|------|-----------|-------|
| `id` | `text` PRIMARY KEY | `meta.id` | Property slug (e.g., `123-main-st-tampa-fl`) |
| `address` | `text` NOT NULL | `meta.address` | Full street address |
| `location` | `text` NOT NULL | `meta.location` | City, State |
| `listing_url` | `text` NOT NULL | `meta.listing_url` | Original listing URL |
| `purchase_price` | `jsonb` NOT NULL | `evidence.purchase_price` | FieldValue object |
| `monthly_rent` | `jsonb` NOT NULL | `evidence.monthly_rent` | FieldValue object |
| `annual_gross_rent` | `numeric` NOT NULL | `underwriting.annual_gross_rent` | Computed value |
| `annual_operating_expenses` | `numeric` NOT NULL | `underwriting.annual_operating_expenses` | Computed value |
| `noi` | `numeric` NOT NULL | `underwriting.noi` | Net Operating Income |
| `cap_rate` | `numeric` NOT NULL | `underwriting.cap_rate` | Unlevered cap rate |
| `hoa` | `jsonb` NOT NULL | `evidence.hoa_monthly` | FieldValue object |
| `assessment` | `jsonb` NOT NULL | `evidence.special_assessments` | FieldValue object |
| `confidence` | `text` NOT NULL | Derived | `HIGH`, `MEDIUM`, or `LOW` |
| `status` | `text` NOT NULL | `audit.final_status` | `VIABLE`, `WATCHLIST`, or `REJECTED` |
| `workflow_state` | `text` NOT NULL | `meta.workflow_state` | Current workflow state |
| `sources` | `jsonb` | Derived | Array of source references |
| `ranked_at` | `timestamptz` | Sync time | When property was ranked/published |
| `created_at` | `timestamptz` DEFAULT now() | — | Row creation time |
| `updated_at` | `timestamptz` DEFAULT now() | — | Last update time |

### FieldValue JSONB Structure

All financial fields use the standard FieldValue shape:

```json
{
  "value": 485,
  "status": "VERIFIED",
  "confidence": "HIGH",
  "source": "https://listing-url",
  "evidence": "Listing states HOA fee of $485/month"
}
```

### Mapping from Git Artifacts

| Git File | Primary Fields Used |
|----------|---------------------|
| `meta.json` | `id`, `address`, `location`, `listing_url`, `workflow_state` |
| `evidence.json` | `purchase_price`, `monthly_rent`, `hoa_monthly`, `special_assessments` |
| `underwriting.json` | `annual_gross_rent`, `annual_operating_expenses`, `noi`, `cap_rate` |
| `audit.json` | `final_status` (becomes `status`) |

### Confidence Derivation

Overall confidence is the **minimum** confidence across key financial fields:
- `purchase_price.confidence`
- `monthly_rent.confidence`
- `hoa_monthly.confidence`

### Sources Derivation

Sources array is built from unique URLs in evidence fields:
- `purchase_price.source`
- `monthly_rent.source`
- `hoa_monthly.source`

## Sync Rules

### When to Sync

Properties are synced to Supabase when:
1. `workflow_state` is `RANKED` or `PUBLISHED`
2. OR `audit.result` is `PASS`

This ensures only validated opportunities appear in UIs.

### Idempotent Upserts

Sync uses `ON CONFLICT (id) DO UPDATE` to:
- Insert new properties
- Update existing properties with changed data
- Never duplicate rows

### Excluded from Sync

- Properties with `workflow_state` in early stages (`CANDIDATE`, `SCREENED`, `RESEARCHING`)
- Scout rejects without full underwriting
- Archived properties (stay Git-only until rescreened)

## Row-Level Security (RLS)

### Recommended Policies

```sql
-- Enable RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Public read access for UI (anon key)
CREATE POLICY "Public read access"
  ON properties
  FOR SELECT
  USING (true);

-- Service role can do everything (sync script)
CREATE POLICY "Service role full access"
  ON properties
  FOR ALL
  USING (auth.role() = 'service_role');
```

### Access Patterns

| Client | Key | Permissions |
|--------|-----|-------------|
| React UI / Browser | `SUPABASE_ANON_KEY` | SELECT only (RLS allows public read) |
| Streamlit Backend | `SUPABASE_SERVICE_ROLE_KEY` | SELECT only (no writes from UI) |
| Sync Script | `SUPABASE_SERVICE_ROLE_KEY` | INSERT, UPDATE (upserts) |
| GitHub Actions | `SUPABASE_SERVICE_ROLE_KEY` | INSERT, UPDATE (CI sync) |

**Security Rule:** Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser bundles or Streamlit frontend code.

## Environment Variables

Required environment variables (see `.env.example`):

| Variable | Required | Used By |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | All clients |
| `SUPABASE_ANON_KEY` | For browser | React UI |
| `SUPABASE_SERVICE_ROLE_KEY` | For sync | Sync script, Streamlit backend |

## Migration (If Needed)

If the existing Supabase schema differs from the mapping above, create migration files in `supabase/migrations/`:

```sql
-- supabase/migrations/001_add_workflow_state.sql
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS workflow_state text NOT NULL DEFAULT 'PUBLISHED';
```

### Schema Gaps

Document any gaps between existing Supabase tables and the `PropertyOpportunity` schema:

| Gap | Resolution |
|-----|------------|
| Missing `workflow_state` column | Add via migration |
| Different column names | Alias in SELECT queries |
| Extra columns in Supabase | Ignore (backward compatible) |

## Read Client Usage

### TypeScript

```typescript
import { SupabaseClient, listOpportunities, getProperty } from '@realestatehunter/supabase';

const client = new SupabaseClient();

// List all opportunities
const opportunities = await listOpportunities(client);

// Get single property
const property = await getProperty(client, '123-main-st-tampa-fl');
```

### Python (Streamlit)

```python
from db_client import SupabaseClient, list_opportunities, get_property

client = SupabaseClient()

# List all opportunities
opportunities = list_opportunities(client)

# Get single property
property = get_property(client, '123-main-st-tampa-fl')
```

## Sync Script Usage

```bash
# Set environment variables
export SUPABASE_URL="https://quvfkegqgbrvtmufndpn.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run sync
npm run sync:supabase

# Or directly
node scripts/sync-properties-to-supabase.mjs
```

The sync script:
1. Scans `data/properties/*/`
2. Filters for `RANKED`, `PUBLISHED`, or audit `PASS` properties
3. Maps Git artifacts to `PropertyOpportunity` shape
4. Upserts to Supabase
5. Logs results and fails on schema mismatch

## Future Considerations

1. **Bidirectional Sync:** Currently one-way (Git → Supabase). Future task may add Supabase → Git for non-agent edits.

2. **Real-time Subscriptions:** Supabase supports real-time; UIs could subscribe to property changes.

3. **Historical Data:** Consider a `properties_history` table for audit trail separate from Git.

4. **Agent Direct Writes:** Future agents might write directly to Supabase instead of Git files, with Git as backup.
