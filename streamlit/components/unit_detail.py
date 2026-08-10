"""Read-only unit detail sections."""

from __future__ import annotations

import html
from typing import Any

import streamlit as st

from components.building_display import building_card_subtitle, building_nav_label
from components.financial_metrics import format_currency, format_pct


def _format_value(value: Any, *, kind: str = 'text') -> str:
    if value is None or value == '':
        return '—'
    if kind == 'currency':
        return format_currency(float(value))
    if kind == 'pct':
        return format_pct(float(value))
    if kind == 'bool':
        return 'Yes' if value else 'No'
    if kind == 'property_type':
        return str(value).replace('_', ' ').title()
    if kind == 'status':
        return str(value).replace('_', ' ').title()
    return str(value)


def primary_source(sources: list[dict]) -> dict | None:
    if not sources:
        return None
    return sorted(
        sources,
        key=lambda s: (s.get('confidence') or 0, s.get('source_date') or '', s.get('created_at') or ''),
        reverse=True,
    )[0]


def inject_detail_styles() -> None:
    st.markdown(
        """
<style>
  .detail-block { margin-top: 1rem; }
  .detail-block-first { margin-top: 0; }
  .detail-section {
    margin: 0 0 0.45rem;
    font-size: 0.82rem;
    font-weight: 650;
    color: #64748b;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  div[data-testid="stMarkdown"]:has(.unit-detail-col-start) + div[data-testid="stHorizontalBlock"] > div[data-testid="column"] > div[data-testid="stVerticalBlock"] {
    padding-top: 0 !important;
  }
  div[data-testid="stMarkdown"]:has(.unit-detail-col-start) + div[data-testid="stHorizontalBlock"] div[data-testid="stMarkdown"]:has(.detail-block-first) {
    margin-top: 0 !important;
  }
  .detail-grid { display: grid; gap: 0.4rem; margin-bottom: 0.25rem; }
  .detail-row {
    display: grid;
    grid-template-columns: 130px 1fr auto;
    gap: 0.65rem;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
  }
  .detail-label { font-size: 0.8rem; color: #64748b; font-weight: 500; }
  .detail-value { font-size: 0.9rem; color: #0f172a; font-weight: 600; }
  .source-pill {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: #eff6ff;
    color: #1d4ed8;
    font-size: 0.7rem;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
  }
</style>
        """,
        unsafe_allow_html=True,
    )


def _source_pill(source: dict | None) -> str:
    if not source or not source.get('source_url'):
        return ''
    label = (source.get('source_type') or 'source').replace('_', ' ').title()
    url = html.escape(source['source_url'], quote=True)
    return (
        f'<a class="source-pill" href="{url}" target="_blank" rel="noopener noreferrer">'
        f'{html.escape(label)}</a>'
    )


def _render_section(
    title: str,
    rows: list[tuple[str, str, dict | None]],
    *,
    first: bool = False,
) -> None:
    body = ''.join(
        f'<div class="detail-row">'
        f'<div class="detail-label">{html.escape(label)}</div>'
        f'<div class="detail-value">{html.escape(value)}</div>'
        f'<div class="detail-source">{_source_pill(src)}</div>'
        f'</div>'
        for label, value, src in rows
    )
    block_class = 'detail-block detail-block-first' if first else 'detail-block'
    st.markdown(
        f'<div class="{block_class}">'
        f'<div class="detail-section">{html.escape(title)}</div>'
        f'<div class="detail-grid">{body}</div>'
        f'</div>',
        unsafe_allow_html=True,
    )


def render_unit_details(
    unit: dict,
    building: dict,
    financials: dict | None,
    sources: list[dict],
    *,
    column: str = 'all',
) -> None:
    fin = financials or {}
    primary = primary_source(sources)
    building_label = building_nav_label(building)
    street = building_card_subtitle(building)
    if street:
        building_label = f'{building_label} · {street}'

    property_rows = [
        ('Unit number', _format_value(unit.get('unit_number')), primary),
        ('Building', _format_value(building_label), primary),
        ('Property type', _format_value(unit.get('property_type'), kind='property_type'), primary),
        ('Status', _format_value(unit.get('status'), kind='status'), primary),
        ('Beds', _format_value(unit.get('beds')), primary),
        ('Baths', _format_value(unit.get('baths')), primary),
        ('Sq ft', _format_value(unit.get('sqft')), primary),
    ]

    financial_rows = [
        ('Monthly rent', _format_value(unit.get('monthly_rent'), kind='currency'), primary),
        ('Purchase price', _format_value(unit.get('purchase_price'), kind='currency'), primary),
        ('Estimated value', _format_value(unit.get('estimated_value'), kind='currency'), primary),
        ('HOA (monthly)', _format_value(unit.get('hoa_monthly'), kind='currency'), primary),
        ('Assessment fees', _format_value(unit.get('assessment_fees_monthly'), kind='currency'), primary),
        ('Other expenses', _format_value(unit.get('other_monthly_expenses'), kind='currency'), primary),
        ('Vacancy rate', _format_value(unit.get('vacancy_rate_pct'), kind='pct'), primary),
        ('NOI (annual)', _format_value(fin.get('noi'), kind='currency'), primary),
        ('Cap rate', _format_value(fin.get('cap_rate_pct'), kind='pct'), primary),
        ('Value basis', _format_value(fin.get('value_basis'), kind='currency'), primary),
    ]

    str_rows = [
        ('STR allowed', _format_value(unit.get('str_allowed'), kind='bool'), primary),
        ('STR notes', _format_value(unit.get('str_notes')), primary),
    ]

    notes_rows = [('Notes', _format_value(unit.get('notes')), primary)] if unit.get('notes') else None

    if column == 'all':
        _render_section('Property', property_rows, first=True)
        _render_section('Financials', financial_rows)
        _render_section('Short-term rental', str_rows)
        if notes_rows:
            _render_section('Notes', notes_rows)
    elif column == 'left':
        _render_section('Property', property_rows, first=True)
        if notes_rows:
            _render_section('Notes', notes_rows)
    elif column == 'right':
        _render_section('Financials', financial_rows, first=True)
        _render_section('Short-term rental', str_rows)
