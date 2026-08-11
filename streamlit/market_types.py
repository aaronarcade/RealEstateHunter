"""Types for market research listings (bulk scrape tier)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class MarketListing:
    id: str
    address: str
    city: str
    state: str
    listing_url: str
    market_area: str
    scrape_batch: str
    scraped_at: str
    source: str = 'redfin'
    zip: Optional[str] = None
    market_id: Optional[str] = None
    asking_price: Optional[float] = None
    beds: Optional[int] = None
    baths: Optional[float] = None
    sqft: Optional[float] = None
    hoa_monthly: Optional[float] = None
    property_type: Optional[str] = None
    year_built: Optional[int] = None
    days_on_market: Optional[int] = None
    mls_id: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


@dataclass
class ListMarketOptions:
    market_area: Optional[str] = None
    city: Optional[str] = None
    property_type: Optional[str] = None
    scrape_batch: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    columns: Optional[str] = None


@dataclass
class MarketFilterFacets:
    areas: list[str]
    property_types: list[str]
    city_rows: list[tuple[str, str]]
