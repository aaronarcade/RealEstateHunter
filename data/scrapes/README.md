# Bulk market scrapes

Raw active-for-sale inventory from Redfin GIS pulls. Scout filters these for condo yield screening; sync script loads them into Supabase `market_listings`.

## US ACTIVE markets (TASK-015)

| Market ID | City | State | Redfin city URL | Region ID | Region type | Market param |
|-----------|------|-------|-----------------|-----------|-------------|--------------|
| `tampa-fl` | Tampa | FL | [city/18142/FL/Tampa](https://www.redfin.com/city/18142/FL/Tampa) | `18142` | `6` (city) | `florida` |
| `jacksonville-fl` | Jacksonville | FL | [city/8907/FL/Jacksonville](https://www.redfin.com/city/8907/FL/Jacksonville) | `8907` | `6` | `florida` |
| `birmingham-al` | Birmingham | AL | [city/1823/AL/Birmingham](https://www.redfin.com/city/1823/AL/Birmingham) | `1823` | `6` | `alabama` |
| `memphis-tn` | Memphis | TN | [city/12260/TN/Memphis](https://www.redfin.com/city/12260/TN/Memphis) | `12260` | `6` | `tennessee` |
| `cleveland-oh` | Cleveland | OH | [city/4145/OH/Cleveland](https://www.redfin.com/city/4145/OH/Cleveland) | `4145` | `6` | `ohio` |

Region IDs are the numeric segment in Redfin `/city/{region_id}/{ST}/{Name}` URLs.

## Scripts

**Single market (any US state):**

```bash
node scripts/scrape-redfin-market.mjs \
  --market tampa-fl \
  --market-area tampa \
  --state FL \
  --market-param florida \
  --regions 18142:6 \
  --output data/scrapes/tampa-fl-active-listings-2026-08-19.json
```

Add `--condo-only` to restrict `uipt` to condos (`property_type: condo`).

**All five zero-coverage US ACTIVE markets:**

```bash
node scripts/scrape-us-active-markets.mjs
node scripts/scrape-us-active-markets.mjs --markets tampa-fl,jacksonville-fl --condo-only
```

**Sync to Supabase:**

```bash
node scripts/sync-market-listings-to-supabase.mjs --file data/scrapes/tampa-fl-active-listings-2026-08-19.json --dry-run
```

## Output schema

Each file under `data/scrapes/{market-id}-active-listings-YYYY-MM-DD.json`:

- `source`: `"redfin"`
- `market`: market slug (e.g. `tampa-fl`)
- `scraped_at`: ISO timestamp
- `count`: listing count
- `listings[]`: `address`, `asking_price`, `beds`, `baths`, `property_type`, `hoa_monthly`, `mls_id`, `listing_url`, `state`, plus optional `sqft`, `lat`, `lng`, `market_area`

Smoke target: **≥100 listings per market** (or document dry-market in commit notes if fewer).

## Existing baselines

| Market | File | Notes |
|--------|------|-------|
| Panama City Beach | `panama-city-beach-fl-active-listings-2026-08-10.json` | Region `14163:6`, FL |
| Fort Walton Beach | `fort-walton-beach-fl-active-listings-2026-08-10.json` | Regions `6298:6`, `4501:6`, FL |

## TASK-017 inventory (commit target)

Committed files for Scout offline volume (full-market Redfin pulls; Scout filters `property_type: condo`):

| Market ID | Expected file pattern |
|-----------|----------------------|
| `tampa-fl` | `tampa-fl-active-listings-YYYY-MM-DD.json` |
| `jacksonville-fl` | `jacksonville-fl-active-listings-YYYY-MM-DD.json` |
| `birmingham-al` | `birmingham-al-active-listings-YYYY-MM-DD.json` |
| `memphis-tn` | `memphis-tn-active-listings-YYYY-MM-DD.json` |
| `cleveland-oh` | `cleveland-oh-active-listings-YYYY-MM-DD.json` |

Smoke target remains **≥100 listings per market**. PR CI on `agent/task-017*` / `cursor/builder-task-017*` branches scrapes and commits these when missing (cloud agent egress blocks `www.redfin.com`).
