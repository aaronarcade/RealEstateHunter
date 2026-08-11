"""Tests for market cap rate enrichment and city baselines."""

from market_enrichment import (
    address_city_key,
    apply_city_baselines,
    baseline_map_color,
    build_cap_rate_index,
    compute_city_baselines,
    compute_noi_per_sqft,
    enrich_market_listings,
    estimate_cap_rate_proxy,
    lookup_cap_rate,
    noi_per_sqft_from_cap,
    resolve_cap_rate,
)
from db_client.types import FieldValue, PropertyOpportunity
from market_types import MarketListing
from reviewed_types import ReviewedListing


def _listing(**kwargs) -> MarketListing:
    base = dict(
        id='test-1',
        address='123 Main St',
        city='Kissimmee',
        state='FL',
        listing_url='https://example.com/listing/1',
        market_area='kissimmee',
        scrape_batch='test-batch',
        scraped_at='2026-08-10T00:00:00Z',
        asking_price=300_000,
        sqft=1500,
        hoa_monthly=250,
        beds=3,
        baths=2,
        property_type='condo',
        days_on_market=30,
    )
    base.update(kwargs)
    return MarketListing(**base)


def _reviewed(**kwargs) -> ReviewedListing:
    base = dict(
        id='rev-1',
        address='123 Main St',
        city='Kissimmee',
        country='US',
        listing_url='https://example.com/listing/1',
        asking_price=300_000,
        scout_decision='RESEARCH',
        reviewed_at='2026-08-10T00:00:00Z',
        estimated_cap_rate=0.12,
    )
    base.update(kwargs)
    return ReviewedListing(**base)


def _property(**kwargs) -> PropertyOpportunity:
    base = dict(
        id='prop-1',
        address='456 Oak Ave',
        location='Celebration, FL',
        listing_url='https://example.com/listing/2',
        purchase_price=FieldValue(value=400_000, status='VERIFIED', confidence='HIGH'),
        monthly_rent=FieldValue(value=3500, status='VERIFIED', confidence='HIGH'),
        annual_gross_rent=42_000,
        annual_operating_expenses=10_000,
        noi=32_000,
        cap_rate=0.08,
        hoa=FieldValue(value=300, status='VERIFIED', confidence='HIGH'),
        assessment=FieldValue(value=0, status='VERIFIED', confidence='HIGH'),
        confidence='HIGH',
        status='WATCHLIST',
    )
    base.update(kwargs)
    return PropertyOpportunity(**base)


def test_noi_per_sqft_from_cap():
    assert noi_per_sqft_from_cap(0.10, 300_000, 1500) == 20.0


def test_compute_noi_per_sqft_prefers_verified_noi():
    assert compute_noi_per_sqft(0.10, 300_000, 1500, noi=25_000) == 25_000 / 1500


def test_address_city_key_normalizes_street_suffix():
    key_a = address_city_key('123 Main Street', 'Kissimmee')
    key_b = address_city_key('123 Main St', 'Kissimmee')
    assert key_a == key_b


def test_lookup_cap_rate_by_url():
    index = build_cap_rate_index([_reviewed()], [])
    match = lookup_cap_rate(_listing(), index)
    assert match is not None
    assert match.cap_rate == 0.12
    assert match.source == 'VERIFIED_REVIEWED'


def test_property_match_beats_reviewed_on_url():
    reviewed = _reviewed(listing_url='https://example.com/listing/1', estimated_cap_rate=0.10)
    prop = _property(listing_url='https://example.com/listing/1', cap_rate=0.14)
    index = build_cap_rate_index([reviewed], [prop])
    match = lookup_cap_rate(_listing(listing_url='https://example.com/listing/1'), index)
    assert match.source == 'VERIFIED_PROPERTY'
    assert match.cap_rate == 0.14


def test_estimate_cap_rate_proxy_subtracts_hoa():
    listing = _listing(asking_price=200_000, hoa_monthly=200)
    proxy = estimate_cap_rate_proxy(listing)
    assert proxy is not None
    assert proxy.source == 'ESTIMATED'
    gross = 200_000 * 0.10
    expected_cap = (gross - 200 * 12) / 200_000
    assert round(proxy.cap_rate, 4) == round(expected_cap, 4)


def test_resolve_cap_rate_falls_back_to_proxy():
    index = build_cap_rate_index([], [])
    match = resolve_cap_rate(_listing(listing_url='https://example.com/unknown'), index)
    assert match is not None
    assert match.source == 'ESTIMATED'


def test_city_baselines_and_deltas():
    listings = [
        _listing(id='a', city='Kissimmee', asking_price=200_000, sqft=2000),
        _listing(id='b', city='Kissimmee', asking_price=400_000, sqft=1000),
        _listing(id='c', city='Celebration', asking_price=500_000, sqft=2500),
    ]
    index = build_cap_rate_index([], [])
    enriched = enrich_market_listings(listings, index)
    baselines = compute_city_baselines(enriched)
    kissimmee = next(item for item in baselines.values() if item.city == 'Kissimmee')
    assert kissimmee.count == 2
    assert kissimmee.median_price == 300_000

    enriched = apply_city_baselines(enriched, baselines)
    low_price = next(item for item in enriched if item.listing.id == 'a')
    assert low_price.price_vs_city_median_pct == -33.3
    assert low_price.sqft_price_vs_city_median_pct is not None


def test_baseline_map_color():
    assert baseline_map_color(100, None) == '#059669'
    assert baseline_map_color(-100, None) == '#dc2626'
    assert baseline_map_color(None, -10) == '#059669'


def test_deals_vs_baseline_via_enrich():
    listings = [
        _listing(id='cheap', city='Kissimmee', asking_price=150_000, sqft=1500),
        _listing(id='dear', city='Kissimmee', asking_price=450_000, sqft=1500),
    ]
    enriched = enrich_market_listings(listings, build_cap_rate_index([], []))
    below = [item for item in enriched if item.sqft_price_vs_city_median_pct is not None and item.sqft_price_vs_city_median_pct < 0]
    assert len(below) == 1
