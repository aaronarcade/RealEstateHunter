"""Market listings data access — isolated from db_client.client for deploy cache safety."""

from __future__ import annotations

from typing import Optional, List

from market_types import ListMarketOptions, MarketListing

from .market_mapper import row_to_market

MARKET_LISTINGS_TABLE = 'market_listings'


def _filter_market_listings(
    listings: list[MarketListing],
    options: ListMarketOptions,
) -> list[MarketListing]:
    filtered = listings
    if options.market_area:
        filtered = [item for item in filtered if item.market_area == options.market_area]
    if options.city:
        filtered = [item for item in filtered if item.city == options.city]
    if options.scrape_batch:
        filtered = [item for item in filtered if item.scrape_batch == options.scrape_batch]
    if options.min_price is not None:
        filtered = [
            item
            for item in filtered
            if item.asking_price is not None and item.asking_price >= options.min_price
        ]
    if options.max_price is not None:
        filtered = [
            item
            for item in filtered
            if item.asking_price is not None and item.asking_price <= options.max_price
        ]
    if options.offset:
        filtered = filtered[options.offset :]
    if options.limit:
        filtered = filtered[: options.limit]
    return filtered


def list_market_listings(client, options: Optional[ListMarketOptions] = None) -> List[MarketListing]:
    """Fetch market listings from Supabase."""
    options = options or ListMarketOptions()
    try:
        response = (
            client.client.table(MARKET_LISTINGS_TABLE)
            .select('*')
            .order('scraped_at', desc=True)
            .execute()
        )
    except Exception:
        return []

    listings = [row_to_market(row) for row in (response.data or [])]
    return _filter_market_listings(listings, options)
