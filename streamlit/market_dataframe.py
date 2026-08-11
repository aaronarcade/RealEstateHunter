"""DataFrame helpers for market research listings."""

from __future__ import annotations

import pandas as pd

from market_types import MarketListing


def listings_to_dataframe(listings: list[MarketListing]) -> pd.DataFrame:
    rows = []
    for item in listings:
        price_per_sqft = None
        if item.asking_price and item.sqft and item.sqft > 0:
            price_per_sqft = item.asking_price / item.sqft
        rows.append(
            {
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
                'price_per_sqft': price_per_sqft,
                'hoa_monthly': item.hoa_monthly,
                'property_type': item.property_type,
                'days_on_market': item.days_on_market,
                'mls_id': item.mls_id,
                'listing_url': item.listing_url,
                'latitude': item.lat,
                'longitude': item.lng,
                'scraped_at': item.scraped_at,
            }
        )
    return pd.DataFrame(rows)
