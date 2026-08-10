"""Financial formatting helpers."""

from __future__ import annotations

import streamlit as st


def format_currency(value, prefix: str = '$') -> str:
    if value is None:
        return '—'
    return f'{prefix}{float(value):,.0f}'


def format_pct(value) -> str:
    if value is None:
        return '—'
    return f'{float(value):.2f}%'


def feasibility_badge(feasible: bool, label: str = 'Feasible') -> None:
    if feasible:
        st.success(f'{label}: Yes')
    else:
        st.warning(f'{label}: Needs review')
