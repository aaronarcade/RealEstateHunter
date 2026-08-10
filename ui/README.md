# RealEstateHunter UI

React-based opportunity comparison UI for RealEstateHunter investment analysis.

## Quick Start

```bash
# Build the shared Supabase client (required dependency)
cd ../lib/supabase && npm install && npm run build && cd ../../ui

# Install UI dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Environment Setup

The UI reads opportunities from **Supabase** via the shared read client in `lib/supabase/` (TASK-007). Create a `.env` file in this directory:

```bash
cp .env.example .env
```

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL (e.g., `https://xxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key (safe for browser) |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_USE_SAMPLE_DATA` | `false` | Set to `true` to use sample data when Supabase returns empty or is not configured |

### Example `.env` file

```bash
VITE_SUPABASE_URL=https://quvfkegqgbrvtmufndpn.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_USE_SAMPLE_DATA=false
```

> **Security Note**: Only use the **anon key** in the browser bundle. Never expose the service role key in frontend code.

## Data Flow

```
Supabase (properties table)
    ↓ @realestatehunter/supabase read client
ui/src/data/supabaseClient.ts
    ↓ fetchOpportunities()
useOpportunities hook
    ↓
OpportunityTable / OpportunityCard
```

### Fallback Behavior

1. **Supabase configured + data available**: Display Supabase data
2. **Supabase configured + empty**: Display empty state (or sample data if `VITE_USE_SAMPLE_DATA=true`)
3. **Supabase not configured**: Fall back to static `/data/opportunities.json`
4. **Any error + `VITE_USE_SAMPLE_DATA=true`**: Display sample data

## Development

### Offline Development

For offline development without Supabase credentials:

```bash
VITE_USE_SAMPLE_DATA=true npm run dev
```

This displays built-in sample opportunities for UI development.

### Testing

```bash
npm test
npm run test:watch
```

Tests mock the Supabase client to avoid network calls.

## Related Documentation

- [Architecture](../docs/ARCHITECTURE.md) - System design and data schemas
- [Supabase Setup](../docs/SUPABASE.md) - Database schema and sync (TASK-007)
- [Product Rules](../docs/PRODUCT.md) - Investment criteria and thresholds
