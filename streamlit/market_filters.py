"""Filters for market research listings."""

from __future__ import annotations

from market_types import MarketListing


def market_areas(listings: list[MarketListing]) -> list[str]:
    return sorted({item.market_area for item in listings if item.market_area})


def market_cities(listings: list[MarketListing], market_area: str | None = None) -> list[str]:
    filtered = listings
    if market_area and market_area != 'All':
        filtered = [item for item in listings if item.market_area == market_area]
    return sorted({item.city for item in filtered if item.city})


def market_cities_from_facets(facets, market_area: str | None = None) -> list[str]:
    rows = facets.city_rows
    if market_area and market_area != 'All':
        rows = [(area, city) for area, city in rows if area == market_area]
    return sorted({city for _area, city in rows if city})


def property_types(listings: list[MarketListing]) -> list[str]:
    return sorted({item.property_type for item in listings if item.property_type})


def apply_market_filters(
    listings: list[MarketListing],
    *,
    market_area: str = 'All',
    city: str = 'All',
    property_type: str = 'All',
    min_price: float | None = None,
    max_price: float | None = None,
) -> list[MarketListing]:
    filtered = listings
    if market_area != 'All':
        filtered = [item for item in filtered if item.market_area == market_area]
    if city != 'All':
        filtered = [item for item in filtered if item.city == city]
    if property_type != 'All':
        filtered = [item for item in filtered if item.property_type == property_type]
    if min_price is not None:
        filtered = [
            item for item in filtered if item.asking_price is not None and item.asking_price >= min_price
        ]
    if max_price is not None:
        filtered = [
            item for item in filtered if item.asking_price is not None and item.asking_price <= max_price
        ]
    return filtered
