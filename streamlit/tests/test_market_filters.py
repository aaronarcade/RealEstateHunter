"""Tests for market listing filters."""

from market_filters import apply_market_filters, market_areas, market_cities
from market_types import MarketListing


def _listing(**kwargs) -> MarketListing:
    base = dict(
        id='test-1',
        address='123 Main St',
        city='Kissimmee',
        state='FL',
        listing_url='https://example.com/1',
        market_area='kissimmee',
        scrape_batch='test-batch',
        scraped_at='2026-08-10T00:00:00Z',
        asking_price=300000,
        property_type='townhouse',
    )
    base.update(kwargs)
    return MarketListing(**base)


def test_market_areas_unique_sorted():
    listings = [
        _listing(market_area='poinciana', id='a'),
        _listing(market_area='kissimmee', id='b'),
        _listing(market_area='celebration', id='c'),
    ]
    assert market_areas(listings) == ['celebration', 'kissimmee', 'poinciana']


def test_filter_by_market_area_and_price():
    listings = [
        _listing(id='a', asking_price=200000, market_area='kissimmee'),
        _listing(id='b', asking_price=400000, market_area='celebration', city='Celebration'),
    ]
    filtered = apply_market_filters(
        listings,
        market_area='celebration',
        min_price=350000,
    )
    assert len(filtered) == 1
    assert filtered[0].id == 'b'


def test_market_cities_respects_area():
    listings = [
        _listing(id='a', city='Kissimmee', market_area='kissimmee'),
        _listing(id='b', city='Celebration', market_area='celebration'),
    ]
    assert market_cities(listings, 'celebration') == ['Celebration']
