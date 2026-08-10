# RealEstateHunter UI

React-based opportunity comparison UI for RealEstateHunter investment analysis.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Environment Setup

The UI reads opportunities from **Supabase**. Create a `.env` file in this directory with your credentials:

```bash
# Copy from the root .env.example or create manually
cp ../.env.example .env
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
Supabase (opportunities table)
    ↓ read via @supabase/supabase-js
React UI (fetchOpportunities)
    ↓ transform to PropertyOpportunity
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
# Run all tests
npm test

# Watch mode
npm run test:watch
```

Tests mock the Supabase client to avoid network calls.

### Linting

```bash
npm run lint
```

## Project Structure

```
ui/
├── src/
│   ├── components/     # UI components (Table, Card, Badges)
│   ├── data/
│   │   ├── loader.ts   # Data fetching logic
│   │   ├── supabase.ts # Supabase client and transforms
│   │   └── sorting.ts  # Opportunity sorting
│   ├── hooks/          # React hooks (useOpportunities)
│   ├── types/          # TypeScript interfaces
│   └── App.tsx         # Main application
├── public/             # Static assets
└── .env                # Local environment (git-ignored)
```

## Related Documentation

- [Architecture](../docs/ARCHITECTURE.md) - System design and data schemas
- [Product Rules](../docs/PRODUCT.md) - Investment criteria and thresholds
- [Supabase Setup](../docs/SUPABASE.md) - Database schema and sync (TASK-007)
