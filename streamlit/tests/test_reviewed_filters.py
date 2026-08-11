"""Tests for reviewed listing filters."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db_client.types import ReviewedListing
from reviewed_filters import apply_reviewed_filters, reviewed_countries, reviewed_cities
from components.reviewed_ui import compute_reviewed_analytics


def _sample_listings() -> list[ReviewedListing]:
    return [
        ReviewedListing(
            id='a',
            address='A',
            city='Manta',
            country='Ecuador',
            listing_url='https://example.com/a',
            asking_price=100000,
            estimated_cap_rate=0.08,
            hoa_monthly=300,
            sqft=900,
            scout_decision='REJECT',
            reviewed_at='2026-08-10T00:00:00Z',
            market_id='manta-ec',
            property_type='condo',
        ),
        ReviewedListing(
            id='b',
            address='B',
            city='Panama City Beach',
            country='United States',
            region='FL',
            listing_url='https://example.com/b',
            asking_price=200000,
            estimated_cap_rate=0.12,
            hoa_monthly=500,
            sqft=1000,
            scout_decision='REJECT',
            reviewed_at='2026-08-10T00:00:00Z',
            market_id='panama-city-beach-fl',
            property_type='condo',
        ),
    ]


def test_reviewed_countries_and_cities():
    listings = _sample_listings()
    assert reviewed_countries(listings) == ['Ecuador', 'United States']
    assert reviewed_cities(listings, 'United States') == ['Panama City Beach']


def test_apply_reviewed_filters_by_country_and_cap_rate():
    listings = _sample_listings()
    filtered = apply_reviewed_filters(
        listings,
        country='United States',
        min_cap_rate=0.10,
    )
    assert [item.id for item in filtered] == ['b']


def test_compute_reviewed_analytics():
    stats = compute_reviewed_analytics(_sample_listings())
    assert stats['count'] == 2
    assert stats['avg_cap_rate'] == 0.10
    assert stats['avg_hoa'] == 400
    assert stats['avg_price_per_sqft'] == (100000 / 900 + 200000 / 1000) / 2
