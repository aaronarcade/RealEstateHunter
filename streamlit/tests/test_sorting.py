"""Sorting tests — parity with ui/src/data/sorting.test.ts."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db_client.types import FieldValue, PropertyOpportunity
from sorting import SortConfig, get_next_sort_direction, sort_opportunities


def _field(value: float = 200000, **kwargs) -> FieldValue:
    return FieldValue(value=value, status='VERIFIED', confidence='HIGH', **kwargs)


def _create(**overrides) -> PropertyOpportunity:
    base = PropertyOpportunity(
        id='test-id',
        address='123 Test St',
        location='Test City, FL',
        listing_url='https://example.com',
        purchase_price=_field(),
        monthly_rent=_field(value=2000),
        annual_gross_rent=24000,
        annual_operating_expenses=4000,
        noi=20000,
        cap_rate=0.1,
        hoa=_field(value=200),
        assessment=_field(value=0),
        confidence='HIGH',
        status='VIABLE',
    )
    for key, value in overrides.items():
        setattr(base, key, value)
    return base


def test_empty_input():
    assert sort_opportunities([]) == []


def test_default_ranking():
    opportunities = [
        _create(id='rejected', status='REJECTED', cap_rate=0.08),
        _create(id='viable-low', status='VIABLE', confidence='LOW'),
        _create(id='viable-high', status='VIABLE', confidence='HIGH'),
        _create(id='watchlist', status='WATCHLIST'),
    ]
    sorted_ids = [o.id for o in sort_opportunities(opportunities)]
    assert sorted_ids == ['viable-high', 'viable-low', 'watchlist', 'rejected']


def test_sort_by_status_asc():
    opportunities = [
        _create(id='rejected', status='REJECTED'),
        _create(id='viable', status='VIABLE'),
        _create(id='watchlist', status='WATCHLIST'),
    ]
    config = SortConfig(field='status', direction='asc')
    sorted_ids = [o.id for o in sort_opportunities(opportunities, config)]
    assert sorted_ids == ['viable', 'watchlist', 'rejected']


def test_sort_by_status_desc():
    opportunities = [
        _create(id='viable', status='VIABLE'),
        _create(id='rejected', status='REJECTED'),
    ]
    config = SortConfig(field='status', direction='desc')
    sorted_ids = [o.id for o in sort_opportunities(opportunities, config)]
    assert sorted_ids == ['rejected', 'viable']


def test_sort_by_cap_rate_desc():
    opportunities = [
        _create(id='low', cap_rate=0.08),
        _create(id='high', cap_rate=0.12),
        _create(id='mid', cap_rate=0.1),
    ]
    config = SortConfig(field='cap_rate', direction='desc')
    sorted_ids = [o.id for o in sort_opportunities(opportunities, config)]
    assert sorted_ids == ['high', 'mid', 'low']


def test_sort_by_noi_desc():
    opportunities = [
        _create(id='low', noi=15000),
        _create(id='high', noi=25000),
        _create(id='mid', noi=20000),
    ]
    config = SortConfig(field='noi', direction='desc')
    sorted_ids = [o.id for o in sort_opportunities(opportunities, config)]
    assert sorted_ids == ['high', 'mid', 'low']


def test_sort_by_confidence():
    opportunities = [
        _create(id='medium', confidence='MEDIUM'),
        _create(id='high', confidence='HIGH'),
        _create(id='low', confidence='LOW'),
    ]
    config = SortConfig(field='confidence', direction='asc')
    sorted_ids = [o.id for o in sort_opportunities(opportunities, config)]
    assert sorted_ids == ['high', 'medium', 'low']


def test_does_not_mutate_original():
    original = [_create(id='b'), _create(id='a')]
    sorted_list = sort_opportunities(original)
    assert sorted_list is not original
    assert original[0].id == 'b'


def test_get_next_sort_direction_status():
    assert get_next_sort_direction(None, 'status') == SortConfig(field='status', direction='asc')


def test_get_next_sort_direction_cap_rate():
    assert get_next_sort_direction(None, 'cap_rate') == SortConfig(field='cap_rate', direction='desc')


def test_get_next_sort_direction_noi():
    assert get_next_sort_direction(None, 'noi') == SortConfig(field='noi', direction='desc')


def test_get_next_sort_direction_toggle():
    current = SortConfig(field='status', direction='asc')
    assert get_next_sort_direction(current, 'status') == SortConfig(field='status', direction='desc')


def test_get_next_sort_direction_new_field():
    current = SortConfig(field='status', direction='desc')
    assert get_next_sort_direction(current, 'cap_rate') == SortConfig(field='cap_rate', direction='desc')
