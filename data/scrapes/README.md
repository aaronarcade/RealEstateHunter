# Market scrapes

Bulk active-for-sale listing dumps under `data/scrapes/`. Scout and market-research UI consume these files (and Supabase sync via `scripts/sync-market-listings-to-supabase.mjs`).

## Schema

Each file:

```json
{
  "source": "redfin",
  "market": "<market-id>",
  "scraped_at": "ISO-8601",
  "status_filter": "active_for_sale",
  "notes": "...",
  "count": 1234,
  "listings": [ /* MarketListing-shaped rows */ ]
}
```

Listing fields used by Scout: `address`, `asking_price`, `beds`, `baths`, `property_type`, `hoa_monthly`, `mls_id`, `listing_url`, `state`, plus `city`, `zip`, `market_area`.

## Redfin region IDs (city, `region_type=6`)

| Market ID | City | State | `region_id` | GIS `market` param | Notes |
|-----------|------|-------|-------------|--------------------|-------|
| `tampa-fl` | Tampa | FL | **18142** | `florida` | TASK-015 |
| `jacksonville-fl` | Jacksonville | FL | **8907** | `florida` | TASK-015 |
| `birmingham-al` | Birmingham | AL | **1823** | `alabama` | TASK-015 |
| `memphis-tn` | Memphis | TN | **12260** | `tennessee` | TASK-015 |
| `cleveland-oh` | Cleveland | OH | **4145** | `ohio` | TASK-015 |
| `panama-city-beach-fl` | Panama City Beach | FL | **14163** | `florida` | Existing |
| `fort-walton-beach-fl` | Fort Walton Beach (+ Destin) | FL | **6298**, **4501** | `florida` | Existing |
| `st-augustine-fl` | St. Augustine | FL | **16053** | `florida` | Existing |

IDs come from Redfin city URLs (`/city/{id}/{ST}/{Name}`).

## Scripts

```bash
# All five US ACTIVE zero-coverage markets
node scripts/scrape-us-active-markets.mjs

# Single market, condo-only (Scout-focused)
node scripts/scrape-us-active-markets.mjs --market tampa-fl --condo-only

# Low-level single scrape
node scripts/scrape-redfin-market.mjs \
  --market tampa-fl \
  --market-area tampa \
  --state FL \
  --market-param florida \
  --regions 18142:6 \
  --output data/scrapes/tampa-fl-active-listings-YYYY-MM-DD.json

# Sync to Supabase
node scripts/sync-market-listings-to-supabase.mjs --file data/scrapes/tampa-fl-active-listings-YYYY-MM-DD.json --dry-run
node scripts/sync-market-listings-to-supabase.mjs --all
```

Smoke expectation: each US ACTIVE market file should have **≥100** listings (document dry-market if fewer).
