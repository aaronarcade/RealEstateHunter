# Market scrapes (`data/scrapes/`)

Bulk active-for-sale inventory used by Scout (filter `property_type: "condo"`, yield screen) and synced to Supabase `market_listings` via `scripts/sync-market-listings-to-supabase.mjs`.

## File schema

Each `*-active-listings-YYYY-MM-DD.json` file:

| Field | Description |
|-------|-------------|
| `source` | e.g. `redfin`, `realtor_graphql`, portal name |
| `market` | Market id slug (`tampa-fl`, …) |
| `scraped_at` | ISO timestamp |
| `status_filter` | Usually `active_for_sale` |
| `notes` | Free-text provenance |
| `count` | Listing count |
| `listings[]` | Raw inventory rows |

US Redfin listing fields include: `address`, `asking_price`, `beds`, `baths`, `property_type`, `hoa_monthly`, `mls_id`, `listing_url`, `state`, plus `city`, `zip`, `sqft`, `market_area`, `source_zips`, etc.

## Redfin region IDs (US)

GIS `region_type=6` = city. Resolve via Redfin city URL `/city/{id}/ST/Name` or location-autocomplete (`id` is `{region_type}_{region_id}`).

### Already scraped (WATCH / ACTIVE with coverage)

| Market | City URL id | Notes |
|--------|-------------|-------|
| `panama-city-beach-fl` | `14163` | ACTIVE; existing scrape 2026-08-10 |
| `st-augustine-fl` | `16053` | WATCH — do not expand until ACTIVE targets met |
| `fort-walton-beach-fl` | (see scrape notes) | WATCH — do not expand until ACTIVE targets met |

### TASK-015 US ACTIVE (zero coverage → scrape these)

| Market ID | City | State | Redfin `region_id` | City URL |
|-----------|------|-------|--------------------|----------|
| `tampa-fl` | Tampa | FL | `18142` | https://www.redfin.com/city/18142/FL/Tampa |
| `jacksonville-fl` | Jacksonville | FL | `8907` | https://www.redfin.com/city/8907/FL/Jacksonville |
| `birmingham-al` | Birmingham | AL | `1823` | https://www.redfin.com/city/1823/AL/Birmingham |
| `memphis-tn` | Memphis | TN | `12260` | https://www.redfin.com/city/12260/TN/Memphis |
| `cleveland-oh` | Cleveland | OH | `4145` | https://www.redfin.com/city/4145/OH/Cleveland |

## Scripts

```bash
# All five US ACTIVE markets (Phase A then B)
node scripts/scrape-us-active-markets.mjs

# Phase A only (Tampa + Jacksonville)
node scripts/scrape-us-active-markets.mjs --phase a

# Single market, condo-only (Scout-focused)
node scripts/scrape-us-active-markets.mjs --market tampa-fl --condo-only

# Low-level single scrape
node scripts/scrape-redfin-market.mjs \
  --market tampa-fl --market-area tampa --state FL \
  --market-param tampa --regions 18142:6 \
  --output data/scrapes/tampa-fl-active-listings-2026-08-16.json

# Sync to Supabase
node scripts/sync-market-listings-to-supabase.mjs --file data/scrapes/tampa-fl-active-listings-2026-08-16.json --dry-run
node scripts/sync-market-listings-to-supabase.mjs --all
```

Smoke threshold: each market file should have ≥100 listings, or a dry-market note in scrape output / Scout notes.
