"""Tests for market research display formatting helpers."""

from components.financial_metrics import (
    cap_rate_decimal_to_pct,
    format_currency,
    format_percent_decimal,
    format_pct,
)
from market_analytics import prepare_city_baseline_rows


def test_format_currency_uses_comma_separators():
    assert format_currency(1_234_567) == '$1,234,567'
    assert format_currency(None) == '—'


def test_format_percent_decimal_from_stored_cap_rate():
    assert format_percent_decimal(0.085) == '8.5%'
    assert format_percent_decimal(None) == '—'


def test_format_pct_from_display_scale():
    assert format_pct(8.5) == '8.50%'
    assert format_pct(None) == '—'


def test_cap_rate_decimal_to_pct():
    assert cap_rate_decimal_to_pct(0.085) == 8.5
    assert cap_rate_decimal_to_pct(None) is None


def test_prepare_city_baseline_rows_converts_median_cap_rate():
    rows = [
        {
            'City': 'Kissimmee',
            'Listings': 10,
            'Median price': 350_000,
            'Median cap rate': 0.085,
        }
    ]
    prepared = prepare_city_baseline_rows(rows)
    assert prepared[0]['Median cap rate'] == 8.5
    assert prepared[0]['Median price'] == 350_000
