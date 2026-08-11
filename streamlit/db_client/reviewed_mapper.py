"""Map Supabase reviewed_listings rows to ReviewedListing."""

from __future__ import annotations

from .types import ReviewedListing


def row_to_reviewed(row: dict) -> ReviewedListing:
    return ReviewedListing(
        id=row['id'],
        address=row['address'],
        city=row['city'],
        country=row['country'],
        region=row.get('region'),
        listing_url=row['listing_url'],
        asking_price=float(row['asking_price']),
        estimated_cap_rate=float(row['estimated_cap_rate'])
        if row.get('estimated_cap_rate') is not None
        else None,
        rough_gross_yield=float(row['rough_gross_yield'])
        if row.get('rough_gross_yield') is not None
        else None,
        estimated_monthly_rent=float(row['estimated_monthly_rent'])
        if row.get('estimated_monthly_rent') is not None
        else None,
        hoa_monthly=float(row['hoa_monthly']) if row.get('hoa_monthly') is not None else None,
        sqft=float(row['sqft']) if row.get('sqft') is not None else None,
        beds=row.get('beds'),
        baths=float(row['baths']) if row.get('baths') is not None else None,
        property_type=row.get('property_type'),
        market_id=row.get('market_id'),
        scout_decision=row['scout_decision'],
        notes=row.get('notes'),
        reviewed_at=row['reviewed_at'],
    )
