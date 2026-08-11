"""Tests for reviewed dataframe and geocoding helpers."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from reviewed_dataframe import listings_to_dataframe
from reviewed_geocoding import geocode_listing
from reviewed_types import ReviewedListing


def _listing(**overrides) -> ReviewedListing:
    base = dict(
        id='test-listing',
        address='14401 Front Beach Rd, Panama City Beach, FL',
        city='Panama City Beach',
        country='United States',
        region='FL',
        listing_url='https://example.com/listing',
        asking_price=125000,
        estimated_cap_rate=0.12,
        rough_gross_yield=0.15,
        hoa_monthly=400,
        sqft=900,
        beds=2,
        scout_decision='REJECT',
        reviewed_at='2026-08-10T00:00:00Z',
        market_id='panama-city-beach-fl',
    )
    base.update(overrides)
    return ReviewedListing(**base)


def test_geocode_listing_known_city():
    lat, lon = geocode_listing(_listing())
    assert lat is not None and lon is not None
    assert 29 < lat < 31
    assert -87 < lon < -85


def test_listings_to_dataframe_columns():
    df = listings_to_dataframe([_listing()])
    assert len(df) == 1
    assert df.iloc[0]['est_cap_pct'] == 12.0
    assert df.iloc[0]['latitude'] is not None
    assert 'listing_url' in df.columns
