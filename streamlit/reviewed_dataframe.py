"""Convert reviewed listings to a pandas DataFrame for Streamlit widgets."""

from __future__ import annotations

import pandas as pd

from reviewed_geocoding import geocode_listing
from reviewed_types import ReviewedListing


def listings_to_dataframe(listings: list[ReviewedListing]) -> pd.DataFrame:
    rows: list[dict] = []
    for item in listings:
        lat, lon = geocode_listing(item)
        cap_pct = item.estimated_cap_rate * 100 if item.estimated_cap_rate is not None else None
        gross_pct = item.rough_gross_yield * 100 if item.rough_gross_yield is not None else None
        price_per_sqft = (
            item.asking_price / item.sqft
            if item.sqft is not None and item.sqft > 0
            else None
        )

        rows.append(
            {
                'address': item.address,
                'city': item.city,
                'region': item.region,
                'country': item.country,
                'asking_price': item.asking_price,
                'est_cap_pct': cap_pct,
                'gross_yield_pct': gross_pct,
                'hoa_monthly': item.hoa_monthly,
                'sqft': item.sqft,
                'price_per_sqft': price_per_sqft,
                'beds': item.beds,
                'baths': item.baths,
                'property_type': item.property_type,
                'market_id': item.market_id,
                'listing_url': item.listing_url,
                'reviewed_at': item.reviewed_at,
                'notes': item.notes,
                'latitude': lat,
                'longitude': lon,
                'id': item.id,
            }
        )

    df = pd.DataFrame(rows)
    if df.empty:
        return df

    return df.sort_values(['country', 'city', 'est_cap_pct'], ascending=[True, True, False], na_position='last')
