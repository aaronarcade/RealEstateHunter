"""Tests for market analytics helpers."""

from market_analytics import (
    compute_area_baseline,
    compute_investment_signals,
    compute_market_analytics,
    compute_yield_proxy_bands,
    required_monthly_rent_for_gross_yield,
    required_rent_after_hoa,
    search_price_range,
)
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
        sqft=1500,
        hoa_monthly=250,
        beds=3,
        baths=2,
        property_type='condo',
        days_on_market=30,
    )
    base.update(kwargs)
    return MarketListing(**base)


def test_required_rent_for_gross_yield():
    assert required_monthly_rent_for_gross_yield(240_000) == 2000
    assert required_rent_after_hoa(240_000, 300) == 2300


def test_compute_area_baseline():
    listings = [
        _listing(id='a', asking_price=200_000, hoa_monthly=400, market_area='kissimmee'),
        _listing(id='b', asking_price=400_000, hoa_monthly=600, market_area='kissimmee'),
        _listing(id='c', asking_price=500_000, hoa_monthly=100, market_area='celebration'),
    ]
    baseline = compute_area_baseline(listings, 'kissimmee')
    assert baseline.count == 2
    assert baseline.median_price == 300_000
    assert baseline.pct_hoa_over_500 == 50.0


def test_investment_signals_counts():
    listings = [
        _listing(id='a', asking_price=200_000, sqft=2000, hoa_monthly=100),
        _listing(id='b', asking_price=400_000, sqft=1000, hoa_monthly=600, beds=1),
        _listing(id='c', asking_price=100_000, sqft=2500, hoa_monthly=200, beds=2),
    ]
    signals = compute_investment_signals(listings, price_min=75_000, price_max=750_000, beds_min=2)
    assert signals.scout_price_range_2br_plus == 2
    assert signals.hoa_over_scrutiny == 1
    assert signals.under_median_price_per_sqft >= 1


def test_yield_proxy_bands():
    listings = [
        _listing(id='a', asking_price=150_000),
        _listing(id='b', asking_price=250_000, hoa_monthly=200),
        _listing(id='c', asking_price=800_000),
    ]
    bands = compute_yield_proxy_bands(listings)
    under_200 = next(item for item in bands if item.label == 'Under $200k')
    over_750 = next(item for item in bands if item.label == 'Over $750k')
    assert under_200.count == 1
    assert over_750.count == 1
    assert under_200.median_required_rent == 1250


def test_compute_market_analytics_includes_area_baselines():
    listings = [
        _listing(id='a', market_area='kissimmee'),
        _listing(id='b', market_area='celebration', city='Celebration'),
    ]
    analytics = compute_market_analytics(listings)
    assert analytics.count == 2
    assert len(analytics.baselines_by_area) == 2
    assert analytics.signals.scout_price_range_2br_plus == 2


def test_search_price_range_from_criteria():
    price_min, price_max = search_price_range()
    assert price_min == 75_000
    assert price_max == 750_000
