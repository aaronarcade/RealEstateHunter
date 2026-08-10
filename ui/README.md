# RealEstateHunter UI

React-based opportunity comparison UI for RealEstateHunter. Displays investment opportunities loaded from Supabase.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the `ui/` directory:

```bash
# Required: Supabase connection
VITE_SUPABASE_URL=https://quvfkegqgbrvtmufndpn.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Fall back to sample data when Supabase returns empty
VITE_USE_SAMPLE_DATA=false
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key (safe for browser use) |
| `VITE_USE_SAMPLE_DATA` | No | Set to `true` to show sample data when Supabase returns empty results |

**Security notes:**
- Only use the **anon key** in the browser, never the service role key
- The anon key is safe to expose because Supabase uses Row Level Security (RLS)
- See `docs/SUPABASE.md` for RLS policy details

### 3. Run development server

```bash
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run linter |

## Architecture

```
src/
├── components/       # UI components (OpportunityCard, OpportunityTable, etc.)
├── data/
│   ├── loader.ts    # Data fetching (calls Supabase)
│   ├── supabase.ts  # Supabase client configuration
│   └── sorting.ts   # Sorting utilities
├── hooks/
│   └── useOpportunities.ts  # Data hook with loading/error states
└── types/
    └── property.ts  # TypeScript interfaces
```

## Data Flow

1. UI loads opportunities via `useOpportunities()` hook
2. Hook calls `fetchOpportunities()` which queries Supabase
3. If Supabase returns empty AND `VITE_USE_SAMPLE_DATA=true`, falls back to sample data
4. Opportunities are sorted and displayed in table or card view

## Development without Supabase

For offline development or when Supabase credentials aren't available:

1. Set `VITE_USE_SAMPLE_DATA=true` in `.env`
2. The UI will display sample data when Supabase returns empty results

## Tech Stack

- React 19 with TypeScript
- Vite for bundling
- Vitest for testing
- Supabase for data storage

## Related Documentation

- Supabase schema and setup: `docs/SUPABASE.md`
- Data architecture: `docs/ARCHITECTURE.md`
- Environment variables: `.env.example` (repo root)
