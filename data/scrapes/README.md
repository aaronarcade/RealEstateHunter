# Market scrapes

Bulk active-for-sale listing pulls used by Scout for volume screening. Files live at:

```text
data/scrapes/{market-id}-active-listings-YYYY-MM-DD.json
```

Payload shape: `source`, `market`, `scraped_at`, `status_filter`, `notes`, `count`, `listings[]`.

Each listing includes at least: `address`, `asking_price`, `beds`, `baths`, `property_type`, `hoa_monthly` (when available), `mls_id`, `listing_url`, `state`, plus `market_area` / geo fields when present.

## US ACTIVE markets (TASK-015)

| Market ID | City | State | Redfin city `region_id` | `region_type` | Redfin URL |
|-----------|------|-------|-------------------------|---------------|------------|
| `tampa-fl` | Tampa | FL | `18142` | `6` | https://www.redfin.com/city/18142/FL/Tampa |
| `jacksonville-fl` | Jacksonville | FL | `8907` | `6` | https://www.redfin.com/city/8907/FL/Jacksonville |
| `birmingham-al` | Birmingham | AL | `1823` | `6` | https://www.redfin.com/city/1823/AL/Birmingham |
| `memphis-tn` | Memphis | TN | `12260` | `6` | https://www.redfin.com/city/12260/TN/Memphis |
| `cleveland-oh` | Cleveland | OH | `4145` | `6` | https://www.redfin.com/city/4145/OH/Cleveland |

Already covered (not part of TASK-015 gap fill):

| Market ID | Redfin city `region_id` | Notes |
|-----------|-------------------------|-------|
| `panama-city-beach-fl` | `14163` | Existing scrape `*-2026-08-10.json` (~2,700 listings) |
| `st-augustine-fl` | `16053` | WATCH market baseline |
| `fort-walton-beach-fl` | `6298` + Destin `4501` | Multi-region pull |

## How to scrape

Single market (multi-state capable):

```bash
node scripts/scrape-redfin-market.mjs \
  --market tampa-fl \
  --market-area tampa \
  --states FL \
  --regions 18142:6 \
  --market-param florida \
  --output data/scrapes/tampa-fl-active-listings-2026-08-15.json
```

All five TASK-015 markets (Phase A then B):

```bash
node scripts/scrape-us-active-markets.mjs --date 2026-08-15
node scripts/scrape-us-active-markets.mjs --phase a --date 2026-08-15   # Tampa + Jacksonville
node scripts/scrape-us-active-markets.mjs --condo-only --market cleveland-oh
```

Condo-focused Scout pulls: pass `--condo-only` (sets GIS `uipt=2` and filters mapped rows to `property_type: "condo"`).

## Sync to Supabase

```bash
node scripts/sync-market-listings-to-supabase.mjs --file data/scrapes/tampa-fl-active-listings-2026-08-15.json --dry-run
node scripts/sync-market-listings-to-supabase.mjs --all
```

Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. New `market_area` values (`tampa`, `jacksonville`, `birmingham`, `memphis`, `cleveland`) map to market IDs in `scripts/sync-market-listings-to-supabase.mjs`.

## Smoke test

Each US ACTIVE scrape file should have **≥100** listings. If a market returns fewer, document it as dry-market in the scrape `notes` and in Scout notes — do not invent listings.
