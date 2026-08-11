"""Market listings data access — isolated from db_client.client for deploy cache safety."""

from __future__ import annotations

from typing import Optional, List

from market_types import ListMarketOptions, MarketFilterFacets, MarketListing

from .market_mapper import row_to_market

MARKET_LISTINGS_TABLE = 'market_listings'
PAGE_SIZE = 1000
FACET_COLUMNS = 'market_area,city,property_type'
LISTING_COLUMNS = (
    'id,address,city,state,zip,market_area,market_id,asking_price,beds,baths,sqft,'
    'hoa_monthly,property_type,year_built,days_on_market,mls_id,listing_url,lat,lng,'
    'source,scrape_batch,scraped_at'
)


def _apply_options_to_query(query, options: ListMarketOptions):
    if options.market_area:
        query = query.eq('market_area', options.market_area)
    if options.city:
        query = query.eq('city', options.city)
    if options.property_type:
        query = query.eq('property_type', options.property_type)
    if options.scrape_batch:
        query = query.eq('scrape_batch', options.scrape_batch)
    if options.min_price is not None:
        query = query.gte('asking_price', options.min_price)
    if options.max_price is not None:
        query = query.lte('asking_price', options.max_price)
    return query


def count_market_listings(client, options: Optional[ListMarketOptions] = None) -> int:
    """Return row count for optional server-side filters without loading rows."""
    options = options or ListMarketOptions()
    try:
        query = (
            client.client.table(MARKET_LISTINGS_TABLE)
            .select('*', count='exact', head=True)
        )
        query = _apply_options_to_query(query, options)
        response = query.execute()
    except Exception:
        return 0
    return response.count or 0


def _fetch_market_rows(
    client,
    options: ListMarketOptions,
    *,
    columns: str = '*',
) -> list[dict]:
    """Paginate past PostgREST default 1000-row cap with optional server-side filters."""
    rows: list[dict] = []
    offset = options.offset or 0
    while True:
        query = client.client.table(MARKET_LISTINGS_TABLE).select(columns)
        query = _apply_options_to_query(query, options)
        query = query.order('scraped_at', desc=True)

        page_end = offset + PAGE_SIZE - 1
        if options.limit is not None:
            remaining = options.limit - len(rows)
            if remaining <= 0:
                break
            page_end = min(page_end, offset + remaining - 1)

        query = query.range(offset, page_end)
        response = query.execute()
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        if options.limit is not None and len(rows) >= options.limit:
            break
        offset += PAGE_SIZE
    return rows


def _fetch_all_market_rows(client, options: Optional[ListMarketOptions] = None) -> list[dict]:
    """Fetch all rows matching options (unfiltered when options is empty)."""
    return _fetch_market_rows(client, options or ListMarketOptions())


def _filter_market_listings(
    listings: list[MarketListing],
    options: ListMarketOptions,
) -> list[MarketListing]:
    """In-memory filter fallback (scrape files and post-fetch limit/offset)."""
    filtered = listings
    if options.market_area:
        filtered = [item for item in filtered if item.market_area == options.market_area]
    if options.city:
        filtered = [item for item in filtered if item.city == options.city]
    if options.property_type:
        filtered = [item for item in filtered if item.property_type == options.property_type]
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


def list_market_filter_facets(client) -> MarketFilterFacets:
    """Load sidebar facet values without fetching full listing payloads."""
    try:
        rows = _fetch_market_rows(
            client,
            ListMarketOptions(),
            columns=FACET_COLUMNS,
        )
    except Exception:
        return MarketFilterFacets(areas=[], property_types=[], city_rows=[])

    areas = sorted({row['market_area'] for row in rows if row.get('market_area')})
    property_types = sorted({row['property_type'] for row in rows if row.get('property_type')})
    city_rows = [
        (row['market_area'], row['city'])
        for row in rows
        if row.get('market_area') and row.get('city')
    ]
    return MarketFilterFacets(
        areas=areas,
        property_types=property_types,
        city_rows=city_rows,
    )


def list_market_listings(client, options: Optional[ListMarketOptions] = None) -> List[MarketListing]:
    """Fetch market listings from Supabase with server-side filters when set."""
    options = options or ListMarketOptions()
    columns = options.columns or LISTING_COLUMNS
    try:
        rows = _fetch_market_rows(client, options, columns=columns)
    except Exception:
        return []

    listings = [row_to_market(row) for row in rows]
    if options.offset or options.limit:
        return _filter_market_listings(listings, ListMarketOptions(limit=options.limit, offset=options.offset))
    return listings
