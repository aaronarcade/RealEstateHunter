# Supabase Integration

This document describes how RealEstateHunter uses Supabase as the runtime data store for UIs and dashboards.

## Project

- **URL:** `https://quvfkegqgbrvtmufndpn.supabase.co`
- **Dashboard:** `https://supabase.com/dashboard/project/quvfkegqgbrvtmufndpn`

Keys are stored as environment variables / secrets (never committed):

| Variable | Purpose | Where |
|----------|---------|-------|
| `SUPABASE_URL` | Project URL | `.env`, GitHub secrets, Streamlit secrets |
| `SUPABASE_SERVICE_ROLE_KEY` | Full access (sync scripts, server only) | GitHub secrets, Streamlit backend |
| `SUPABASE_ANON_KEY` | RLS-restricted reads (browser, public UIs) | `.env`, Vite env vars |

## Architecture

```
Cloud Agents → PR → data/properties/{id}/*.json  (workflow / audit trail in Git)
                         ↓ sync (on publish or merge)
                   Supabase (properties table)
                         ↓ read
              React UI / Streamlit / future tools
```

| Layer | Role |
|-------|------|
| **Git JSON** | Agent handoffs, schema validation, PR review, orchestrator state |
| **Supabase** | Live reads for UI, filters, history, optional non-agent edits |
| **Sync** | One-way Git → Supabase when property reaches `RANKED`, `PUBLISHED`, or audit `PASS` |

## Database Schema

### `properties` table

Primary table for property opportunities. Maps to the `PropertyOpportunity` interface.

```sql
CREATE TABLE properties (
  id TEXT PRIMARY KEY,                    -- Slug identifier (e.g., "123-main-st-tampa-fl")
  address TEXT NOT NULL,
  location TEXT NOT NULL,
  listing_url TEXT NOT NULL,
  
  -- Financial fields (JSONB for FieldValue structure)
  purchase_price JSONB NOT NULL,          -- FieldValue: { value, status, confidence, source, evidence }
  monthly_rent JSONB NOT NULL,            -- FieldValue
  hoa JSONB NOT NULL,                     -- FieldValue
  assessment JSONB NOT NULL,              -- FieldValue (special_assessments)
  
  -- Computed values (from underwriting)
  annual_gross_rent NUMERIC NOT NULL,
  annual_operating_expenses NUMERIC NOT NULL,
  noi NUMERIC NOT NULL,
  cap_rate NUMERIC NOT NULL,
  
  -- Classification
  confidence TEXT NOT NULL CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  status TEXT NOT NULL CHECK (status IN ('VIABLE', 'WATCHLIST', 'REJECTED')),
  
  -- Workflow state
  workflow_state TEXT NOT NULL CHECK (workflow_state IN (
    'CANDIDATE', 'SCREENED', 'RESEARCHING', 'READY_FOR_UNDERWRITING',
    'UNDERWRITTEN', 'AUDIT', 'RANKED', 'PUBLISHED', 'ARCHIVED'
  )),
  
  -- Sources (array of { label, url })
  sources JSONB DEFAULT '[]'::JSONB,
  
  -- Timestamps
  ranked_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_workflow_state ON properties(workflow_state);
CREATE INDEX idx_properties_cap_rate ON properties(cap_rate DESC);
```

### `property_details` table (optional)

Stores full evidence, underwriting, and audit JSON for detailed views.

```sql
CREATE TABLE property_details (
  property_id TEXT PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  evidence JSONB,                         -- Full evidence.json
  underwriting JSONB,                     -- Full underwriting.json
  audit JSONB,                            -- Full audit.json
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Schema Mapping

### Git Artifacts → Supabase Columns

| Git File | Supabase | Notes |
|----------|----------|-------|
| `meta.json` | `properties.id`, `address`, `location`, `listing_url`, `workflow_state` | Core identifiers |
| `evidence.json` | `properties.purchase_price`, `monthly_rent`, `hoa`, `assessment` | FieldValue JSONB |
| `underwriting.json` | `properties.annual_gross_rent`, `noi`, `cap_rate`, `status` | Computed values |
| `audit.json` | `properties.status` (final_status), `property_details.audit` | Final classification |

### FieldValue Structure

Each financial field is stored as JSONB matching the `field-value.json` schema:

```json
{
  "value": 200000,
  "status": "VERIFIED",
  "confidence": "HIGH",
  "source": "https://listing-url",
  "evidence": "Listing asking price $200,000",
  "range_low": null,
  "range_high": null
}
```

### PropertyOpportunity → Supabase Row

The TypeScript `PropertyOpportunity` interface maps directly to the `properties` table:

| Interface Field | Column | Type |
|-----------------|--------|------|
| `id` | `id` | TEXT |
| `address` | `address` | TEXT |
| `location` | `location` | TEXT |
| `listingUrl` | `listing_url` | TEXT |
| `purchasePrice` | `purchase_price` | JSONB |
| `monthlyRent` | `monthly_rent` | JSONB |
| `annualGrossRent` | `annual_gross_rent` | NUMERIC |
| `annualOperatingExpenses` | `annual_operating_expenses` | NUMERIC |
| `noi` | `noi` | NUMERIC |
| `capRate` | `cap_rate` | NUMERIC |
| `hoa` | `hoa` | JSONB |
| `assessment` | `assessment` | JSONB |
| `confidence` | `confidence` | TEXT |
| `status` | `status` | TEXT |
| `sources` | `sources` | JSONB |
| `rankedAt` | `ranked_at` | TIMESTAMPTZ |

## Row Level Security (RLS)

### Read Policy

Allow anonymous reads for published/ranked properties:

```sql
-- Enable RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Public read for ranked/published properties
CREATE POLICY "Public read for published properties"
  ON properties FOR SELECT
  USING (workflow_state IN ('RANKED', 'PUBLISHED'));

-- Authenticated users can read all
CREATE POLICY "Authenticated read all"
  ON properties FOR SELECT
  TO authenticated
  USING (true);
```

### Write Policy

Only service role (sync scripts) can write:

```sql
-- Service role has full access by default (bypasses RLS)
-- No additional write policies needed for anon/authenticated
```

## Sync Process

### When to Sync

Properties are synced to Supabase when:
1. `workflow_state` changes to `RANKED` or `PUBLISHED`
2. `audit.result` is `PASS`
3. Manual sync via `scripts/sync-properties-to-supabase.mjs`

### Sync Script

Location: `scripts/sync-properties-to-supabase.mjs`

```bash
# Sync all eligible properties
node scripts/sync-properties-to-supabase.mjs

# Sync specific property
node scripts/sync-properties-to-supabase.mjs --property 123-main-st-tampa-fl

# Dry run (no writes)
node scripts/sync-properties-to-supabase.mjs --dry-run
```

### GitHub Action

Runs automatically on push to `main` when `data/properties/**` changes.

Location: `.github/workflows/sync-properties.yml`

## Read Clients

### TypeScript (`lib/supabase/`)

```typescript
import { createClient } from './client';
import { listOpportunities, getProperty } from './queries';

const supabase = createClient();
const opportunities = await listOpportunities(supabase, { status: 'VIABLE' });
const property = await getProperty(supabase, '123-main-st-tampa-fl');
```

### Python (`lib/supabase_py/`)

```python
from lib.supabase_py import create_client, list_opportunities, get_property

client = create_client()
opportunities = list_opportunities(client, status='VIABLE')
property = get_property(client, '123-main-st-tampa-fl')
```

## Environment Setup

### Local Development

```bash
cp .env.example .env
# Edit .env with your Supabase keys
```

### Streamlit

Create `.streamlit/secrets.toml`:

```toml
SUPABASE_URL = "https://quvfkegqgbrvtmufndpn.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
```

### GitHub Actions

Add secrets in repository settings:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Migrations

If schema changes are needed, use the Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Create migration
supabase migration new add_new_column

# Apply migrations
supabase db push
```

Migration files go in `supabase/migrations/`.
