"""Filters for reviewed listings browse view."""

from __future__ import annotations

from reviewed_types import ReviewedListing


def reviewed_countries(listings: list[ReviewedListing]) -> list[str]:
    return sorted({item.country for item in listings})


def reviewed_cities(listings: list[ReviewedListing], country: str | None = None) -> list[str]:
    rows = listings
    if country and country != 'All':
        rows = [item for item in rows if item.country == country]
    return sorted({item.city for item in rows})


def reviewed_markets(listings: list[ReviewedListing]) -> list[str]:
    return sorted({item.market_id for item in listings if item.market_id})


def reviewed_property_types(listings: list[ReviewedListing]) -> list[str]:
    return sorted({item.property_type for item in listings if item.property_type})


def apply_reviewed_filters(
    listings: list[ReviewedListing],
    *,
    country: str = 'All',
    city: str = 'All',
    market_id: str = 'All',
    property_type: str = 'All',
    min_cap_rate: float | None = None,
    max_cap_rate: float | None = None,
) -> list[ReviewedListing]:
    rows = listings
    if country != 'All':
        rows = [item for item in rows if item.country == country]
    if city != 'All':
        rows = [item for item in rows if item.city == city]
    if market_id != 'All':
        rows = [item for item in rows if item.market_id == market_id]
    if property_type != 'All':
        rows = [item for item in rows if item.property_type == property_type]
    if min_cap_rate is not None:
        rows = [
            item
            for item in rows
            if item.estimated_cap_rate is not None and item.estimated_cap_rate >= min_cap_rate
        ]
    if max_cap_rate is not None:
        rows = [
            item
            for item in rows
            if item.estimated_cap_rate is not None and item.estimated_cap_rate <= max_cap_rate
        ]
    return rows
