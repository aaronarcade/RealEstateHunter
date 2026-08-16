"""Data loader tests — sample fallback and publishable-status filter contract."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from data_loader import PUBLISHABLE_STATUSES, load_opportunities
from db_client.types import FieldValue, PropertyOpportunity
from sample_data import SAMPLE_OPPORTUNITIES


def _opp(status: str = 'VIABLE') -> PropertyOpportunity:
    field = FieldValue(value=100000, status='VERIFIED', confidence='HIGH')
    return PropertyOpportunity(
        id='mock-1',
        address='1 Test St',
        location='Test, FL',
        listing_url='https://example.com',
        purchase_price=field,
        monthly_rent=field,
        annual_gross_rent=12000,
        annual_operating_expenses=2000,
        noi=10000,
        cap_rate=0.1,
        hoa=field,
        assessment=field,
        confidence='HIGH',
        status=status,  # type: ignore[arg-type]
    )


def test_publishable_statuses_match_react_filter():
    assert PUBLISHABLE_STATUSES == ['VIABLE', 'WATCHLIST', 'REJECTED']


def test_sample_data_flag_skips_supabase():
    result = load_opportunities(use_sample_data=True)
    assert result.source == 'sample'
    assert result.error is None
    assert len(result.opportunities) == len(SAMPLE_OPPORTUNITIES)
    assert result.opportunities[0].id == SAMPLE_OPPORTUNITIES[0].id


def test_missing_credentials_falls_back_to_sample():
    with patch('data_loader._resolve_supabase_config', return_value=(None, None, None)):
        result = load_opportunities(use_sample_data=False)
    assert result.source == 'sample'
    assert result.error is not None
    assert 'credentials' in result.error.lower()
    assert len(result.opportunities) == len(SAMPLE_OPPORTUNITIES)


def test_supabase_success_uses_publishable_filter():
    mock_client = MagicMock()
    rows = [_opp('VIABLE'), _opp('WATCHLIST')]
    with (
        patch('data_loader._resolve_supabase_config', return_value=('https://x.supabase.co', 'svc', None)),
        patch('data_loader.SupabaseClient', return_value=mock_client) as client_cls,
        patch('data_loader.list_opportunities', return_value=rows) as list_fn,
    ):
        result = load_opportunities(use_sample_data=False)

    client_cls.assert_called_once()
    list_fn.assert_called_once()
    options = list_fn.call_args.args[1]
    assert options.status == PUBLISHABLE_STATUSES
    assert result.source == 'supabase'
    assert result.error is None
    assert len(result.opportunities) == 2


def test_supabase_empty_returns_empty_with_message():
    with (
        patch('data_loader._resolve_supabase_config', return_value=('https://x.supabase.co', 'svc', None)),
        patch('data_loader.SupabaseClient', return_value=MagicMock()),
        patch('data_loader.list_opportunities', return_value=[]),
    ):
        result = load_opportunities(use_sample_data=False)

    assert result.source == 'supabase'
    assert result.opportunities == []
    assert result.error is not None
    assert 'No units' in result.error


def test_supabase_failure_falls_back_to_sample():
    with (
        patch('data_loader._resolve_supabase_config', return_value=('https://x.supabase.co', 'svc', None)),
        patch('data_loader.SupabaseClient', side_effect=RuntimeError('boom')),
    ):
        result = load_opportunities(use_sample_data=False)

    assert result.source == 'sample'
    assert result.error is not None
    assert 'Failed to load' in result.error
    assert len(result.opportunities) == len(SAMPLE_OPPORTUNITIES)
