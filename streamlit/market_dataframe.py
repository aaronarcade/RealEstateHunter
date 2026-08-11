"""DataFrame helpers for market research listings."""

from __future__ import annotations

import pandas as pd

from components.financial_metrics import cap_rate_decimal_to_pct
from market_enrichment import EnrichedMarketListing
from market_types import MarketListing


def _price_per_sqft(listing: MarketListing) -> float | None:
    if listing.asking_price and listing.sqft and listing.sqft > 0:
        return listing.asking_price / listing.sqft
    return None


def listings_to_dataframe(listings: list[MarketListing]) -> pd.DataFrame:
    rows = []
    for item in listings:
        rows.append(_listing_row(item))
    return pd.DataFrame(rows)


def enriched_listings_to_dataframe(enriched: list[EnrichedMarketListing]) -> pd.DataFrame:
    rows = []
    for entry in enriched:
        row = _listing_row(entry.listing)
        row['cap_rate'] = entry.cap_rate
        row['cap_rate_pct'] = cap_rate_decimal_to_pct(entry.cap_rate)
        row['cap_rate_source'] = entry.cap_rate_source
        row['noi_per_sqft'] = entry.noi_per_sqft
        row['price_vs_city_median_pct'] = entry.price_vs_city_median_pct
        row['sqft_price_vs_city_median_pct'] = entry.sqft_price_vs_city_median_pct
        row['cap_rate_vs_city_median_bps'] = entry.cap_rate_vs_city_median_bps
        row['noi_per_sqft_vs_city_median_pct'] = entry.noi_per_sqft_vs_city_median_pct
        row['map_color'] = entry.map_color
        rows.append(row)
    return pd.DataFrame(rows)


def _listing_row(item: MarketListing) -> dict:
    return {
        'id': item.id,
        'address': item.address,
        'city': item.city,
        'state': item.state,
        'zip': item.zip,
        'market_area': item.market_area,
        'asking_price': item.asking_price,
        'beds': item.beds,
        'baths': item.baths,
        'sqft': item.sqft,
        'price_per_sqft': _price_per_sqft(item),
        'hoa_monthly': item.hoa_monthly,
        'property_type': item.property_type,
        'days_on_market': item.days_on_market,
        'mls_id': item.mls_id,
        'listing_url': item.listing_url,
        'latitude': item.lat,
        'longitude': item.lng,
        'scraped_at': item.scraped_at,
    }
