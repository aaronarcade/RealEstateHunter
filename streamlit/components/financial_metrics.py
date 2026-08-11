"""Financial formatting helpers."""

from __future__ import annotations

import streamlit as st

# Streamlit NumberColumn d3-format strings (value already on display scale).
CURRENCY_COLUMN_FORMAT = '$%,.0f'
PERCENT_COLUMN_FORMAT = '%.1f%%'
CAP_RATE_COLUMN_FORMAT = '%.2f%%'

# Cap rates in pipeline data are stored as decimals (0.085 = 8.5%).


def format_currency(value, prefix: str = '$') -> str:
    if value is None:
        return '—'
    return f'{prefix}{float(value):,.0f}'


def format_pct(value) -> str:
    """Format a value already on a 0–100 percent scale (e.g. 8.5 → ``8.50%``)."""
    if value is None:
        return '—'
    return f'{float(value):.2f}%'


def format_percent_decimal(value) -> str:
    """Format a cap rate stored as decimal 0–1 (e.g. 0.085 → ``8.5%``)."""
    if value is None:
        return '—'
    return f'{float(value) * 100:.1f}%'


def cap_rate_decimal_to_pct(value) -> float | None:
    """Convert stored cap rate decimal to display percent scale."""
    if value is None:
        return None
    return float(value) * 100


def feasibility_badge(feasible: bool, label: str = 'Feasible') -> None:
    if feasible:
        st.success(f'{label}: Yes')
    else:
        st.warning(f'{label}: Needs review')
