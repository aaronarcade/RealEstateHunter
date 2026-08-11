"""Tests for market listings Supabase pagination and server-side filters."""

from __future__ import annotations

from db_client.market_client import (
    FACET_COLUMNS,
    LISTING_COLUMNS,
    PAGE_SIZE,
    _fetch_all_market_rows,
    _fetch_market_rows,
    count_market_listings,
    list_market_filter_facets,
    list_market_listings,
)
from market_types import ListMarketOptions


class _FakeQuery:
    def __init__(self, pages: list[list[dict]]):
        self._all_rows = [row for page in pages for row in page]
        self._filters: list[tuple[str, str, object]] = []
        self._columns = '*'
        self._count_only = False
        self._head = False
        self._offset = 0
        self._end: int | None = None

    def select(self, columns='*', count=None, head=False):
        self._columns = columns
        self._count_only = count == 'exact'
        self._head = head
        return self

    def order(self, *_args, **_kwargs):
        return self

    def eq(self, column: str, value):
        self._filters.append(('eq', column, value))
        return self

    def gte(self, column: str, value):
        self._filters.append(('gte', column, value))
        return self

    def lte(self, column: str, value):
        self._filters.append(('lte', column, value))
        return self

    def range(self, start: int, end: int):
        self._offset = start
        self._end = end
        return self

    def _apply_filters(self, rows: list[dict]) -> list[dict]:
        filtered = rows
        for op, column, value in self._filters:
            if op == 'eq':
                filtered = [row for row in filtered if row.get(column) == value]
            elif op == 'gte':
                filtered = [
                    row
                    for row in filtered
                    if row.get(column) is not None and row.get(column) >= value
                ]
            elif op == 'lte':
                filtered = [
                    row
                    for row in filtered
                    if row.get(column) is not None and row.get(column) <= value
                ]
        return filtered

    def _project_columns(self, rows: list[dict]) -> list[dict]:
        if self._columns in ('*', None):
            return rows
        columns = [column.strip() for column in self._columns.split(',')]
        return [{column: row.get(column) for column in columns} for row in rows]

    def execute(self):
        filtered = self._apply_filters(self._all_rows)
        if self._count_only or self._head:
            return type('Response', (), {'data': [], 'count': len(filtered)})()

        batch = filtered[self._offset : (self._end or self._offset) + 1]
        batch = self._project_columns(batch)
        return type('Response', (), {'data': batch, 'count': len(filtered)})()


class _FakeSupabaseClient:
    def __init__(self, pages: list[list[dict]]):
        self._pages = pages

    @property
    def client(self):
        return self

    def table(self, _name: str):
        return _FakeQuery(self._pages)


def _market_row(index: int, **overrides) -> dict:
    row = {
        'id': f'row-{index}',
        'address': f'{index} Main St',
        'city': 'Kissimmee',
        'state': 'FL',
        'market_area': 'kissimmee',
        'asking_price': 250000 + index,
        'property_type': 'townhouse',
        'listing_url': f'https://example.com/{index}',
        'scrape_batch': 'test-batch',
        'scraped_at': '2026-08-10T00:00:00Z',
        'lat': 28.3,
        'lng': -81.4,
    }
    row.update(overrides)
    return row


def _pages_for_row_count(total_rows: int) -> list[list[dict]]:
    pages: list[list[dict]] = []
    for offset in range(0, total_rows, PAGE_SIZE):
        pages.append(
            [_market_row(index) for index in range(offset, min(offset + PAGE_SIZE, total_rows))]
        )
    return pages


def test_fetch_all_market_rows_paginates_past_default_cap():
    pages = _pages_for_row_count(1500)
    rows = _fetch_all_market_rows(_FakeSupabaseClient(pages))
    assert len(rows) == 1500
    assert rows[0]['id'] == 'row-0'
    assert rows[-1]['id'] == 'row-1499'


def test_fetch_all_market_rows_loads_more_than_one_thousand_rows():
    total_rows = 8357
    rows = _fetch_all_market_rows(_FakeSupabaseClient(_pages_for_row_count(total_rows)))
    assert len(rows) == total_rows
    assert rows[999]['id'] == 'row-999'
    assert rows[1000]['id'] == 'row-1000'
    assert rows[-1]['id'] == f'row-{total_rows - 1}'


def test_list_market_listings_maps_all_paginated_rows():
    total_rows = 2501
    listings = list_market_listings(_FakeSupabaseClient(_pages_for_row_count(total_rows)))
    assert len(listings) == total_rows


def test_count_market_listings_applies_server_side_filters():
    rows = [
        _market_row(0, market_area='kissimmee', asking_price=200000),
        _market_row(1, market_area='celebration', asking_price=400000),
        _market_row(2, market_area='kissimmee', asking_price=500000),
    ]
    client = _FakeSupabaseClient([rows])
    options = ListMarketOptions(market_area='kissimmee', min_price=300000)
    assert count_market_listings(client, options) == 1


def test_fetch_market_rows_applies_filters_and_column_projection():
    rows = [
        _market_row(0, market_area='kissimmee', property_type='condo'),
        _market_row(1, market_area='celebration', property_type='townhouse'),
    ]
    client = _FakeSupabaseClient([rows])
    options = ListMarketOptions(market_area='kissimmee', property_type='condo')
    fetched = _fetch_market_rows(client, options, columns=FACET_COLUMNS)
    assert len(fetched) == 1
    assert set(fetched[0].keys()) == {'market_area', 'city', 'property_type'}


def test_list_market_listings_uses_listing_columns_by_default():
    rows = [_market_row(0)]
    client = _FakeSupabaseClient([rows])
    listings = list_market_listings(client)
    assert len(listings) == 1
    assert listings[0].market_area == 'kissimmee'


def test_list_market_filter_facets_returns_unique_values():
    rows = [
        _market_row(0, market_area='kissimmee', city='Kissimmee', property_type='condo'),
        _market_row(1, market_area='celebration', city='Celebration', property_type='townhouse'),
        _market_row(2, market_area='kissimmee', city='Kissimmee', property_type='condo'),
    ]
    facets = list_market_filter_facets(_FakeSupabaseClient([rows]))
    assert facets.areas == ['celebration', 'kissimmee']
    assert facets.property_types == ['condo', 'townhouse']
    assert ('kissimmee', 'Kissimmee') in facets.city_rows
