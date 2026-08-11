"""Map Supabase market_listings rows to MarketListing."""

from __future__ import annotations

from market_types import MarketListing


def row_to_market(row: dict) -> MarketListing:
    return MarketListing(
        id=row['id'],
        address=row['address'],
        city=row['city'],
        state=row['state'],
        zip=row.get('zip'),
        market_area=row['market_area'],
        market_id=row.get('market_id'),
        asking_price=float(row['asking_price']) if row.get('asking_price') is not None else None,
        beds=row.get('beds'),
        baths=float(row['baths']) if row.get('baths') is not None else None,
        sqft=float(row['sqft']) if row.get('sqft') is not None else None,
        hoa_monthly=float(row['hoa_monthly']) if row.get('hoa_monthly') is not None else None,
        property_type=row.get('property_type'),
        year_built=row.get('year_built'),
        days_on_market=row.get('days_on_market'),
        mls_id=row.get('mls_id'),
        listing_url=row['listing_url'],
        lat=float(row['lat']) if row.get('lat') is not None else None,
        lng=float(row['lng']) if row.get('lng') is not None else None,
        source=row.get('source') or 'redfin',
        scrape_batch=row['scrape_batch'],
        scraped_at=row['scraped_at'],
    )
