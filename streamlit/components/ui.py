"""Streamlit UI components — parity with React OpportunityTable/Card and RealEstateTracker styling."""

from __future__ import annotations

import html
from typing import Optional

import streamlit as st

from db_client.types import ConfidenceLevel, FieldValue, PropertyOpportunity, PropertyStatus
from sorting import SortConfig, SortField

CARD_COLUMNS = 3

_STATUS_ROW_BG = {
    'VIABLE': '#f0fdf4',
    'WATCHLIST': '#fffbeb',
    'REJECTED': '#fef2f2',
}

_STATUS_BORDER = {
    'VIABLE': '#22c55e',
    'WATCHLIST': '#eab308',
    'REJECTED': '#ef4444',
}

_STATUS_BADGE = {
    'VIABLE': ('#dcfce7', '#166534', '#86efac'),
    'WATCHLIST': ('#fef3c7', '#92400e', '#fcd34d'),
    'REJECTED': ('#fee2e2', '#991b1b', '#fca5a5'),
}

_CONFIDENCE_BADGE = {
    'HIGH': ('#dbeafe', '#1e40af', '#93c5fd'),
    'MEDIUM': ('#e5e7eb', '#374151', '#9ca3af'),
    'LOW': ('#fef3c7', '#92400e', '#fcd34d'),
}


def inject_global_styles() -> None:
    st.markdown(
        """
<style>
  .block-container { padding-top: 1.25rem; padding-bottom: 2rem; max-width: 1400px; }
  .app-header { margin-bottom: 1.25rem; }
  .app-title { margin: 0; font-size: 1.5rem; font-weight: 700; color: #111827; }
  .app-subtitle { margin: 0.25rem 0 0; color: #6b7280; font-size: 0.875rem; }
  .ranking-footer {
    margin-top: 2rem;
    padding: 1rem 0;
    text-align: center;
    color: #9ca3af;
    font-size: 0.75rem;
  }
  .opp-table-wrap { overflow-x: auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; }
  table.opp-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  table.opp-table th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
    background: #f9fafb;
    white-space: nowrap;
  }
  table.opp-table th.num, table.opp-table td.num { text-align: right; }
  table.opp-table th.center, table.opp-table td.center { text-align: center; }
  table.opp-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: middle;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border: 1px solid transparent;
  }
  .confidence-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 500;
    border: 1px solid transparent;
  }
  .field-status {
    margin-left: 0.25rem;
    font-size: 0.75em;
  }
  .noi-value { font-weight: 500; color: #059669; }
  .cap-good { font-weight: 600; color: #059669; }
  .cap-bad { font-weight: 600; color: #dc2626; }
  div[data-testid="stHorizontalBlock"]:has(div[data-testid="stVerticalBlockBorderWrapper"]) {
    align-items: stretch !important;
  }
  div[data-testid="stHorizontalBlock"]:has(div[data-testid="stVerticalBlockBorderWrapper"]) > div[data-testid="column"] {
    display: flex !important;
    flex-direction: column !important;
  }
  div[data-testid="stHorizontalBlock"]:has(div[data-testid="stVerticalBlockBorderWrapper"]) div[data-testid="stVerticalBlockBorderWrapper"] {
    flex: 1 1 auto !important;
    width: 100% !important;
    border-left-width: 4px !important;
  }
  .card-title { margin: 0; font-size: 1.125rem; font-weight: 600; color: #111827; }
  .card-subtitle { margin: 0; color: #6b7280; font-size: 0.875rem; }
  .metric-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin: 0.75rem 0 1rem;
  }
  .metric-label { font-size: 0.75rem; color: #6b7280; margin-bottom: 0.125rem; }
  .metric-value { font-weight: 500; color: #111827; }
  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.75rem;
    border-top: 1px solid #f3f4f6;
  }
</style>
        """,
        unsafe_allow_html=True,
    )


def format_currency(value: float) -> str:
    return f'${value:,.0f}'


def format_percent(value: float) -> str:
    return f'{value * 100:.1f}%'


def _status_badge(status: PropertyStatus) -> str:
    bg, text, border = _STATUS_BADGE[status]
    return (
        f'<span class="pill" style="background:{bg};color:{text};border-color:{border}">'
        f'{html.escape(status)}</span>'
    )


def _confidence_badge(confidence: ConfidenceLevel) -> str:
    bg, text, border = _CONFIDENCE_BADGE[confidence]
    return (
        f'<span class="confidence-pill" style="background:{bg};color:{text};border-color:{border}">'
        f'{html.escape(confidence)}</span>'
    )


def _field_value_html(field: FieldValue, *, show_status: bool = True) -> str:
    if field.value is None:
        return '<span style="color:#9ca3af">Unknown</span>'

    formatted = format_currency(field.value)
    if not show_status:
        return html.escape(formatted)

    indicator = {'VERIFIED': '✓', 'ESTIMATED': '~', 'UNKNOWN': '?'}[field.status]
    color = {'VERIFIED': '#16a34a', 'ESTIMATED': '#d97706', 'UNKNOWN': '#9ca3af'}[field.status]
    title = html.escape(field.evidence or f'Status: {field.status}, Confidence: {field.confidence}')
    return (
        f'<span title="{title}">{html.escape(formatted)}'
        f'<span class="field-status" style="color:{color}">{indicator}</span></span>'
    )


def render_app_header() -> None:
    st.markdown(
        """
<div class="app-header">
  <p class="app-title">RealEstateHunter</p>
  <p class="app-subtitle">Investment Opportunities</p>
</div>
        """,
        unsafe_allow_html=True,
    )


def render_ranking_footer() -> None:
    st.markdown(
        """
<div class="ranking-footer">
  <p>Ranking priority: Status (VIABLE first) → Confidence → Cap Rate → NOI</p>
  <p style="margin-top:0.25rem">Target: ≥10% unlevered cap rate with verified inputs</p>
</div>
        """,
        unsafe_allow_html=True,
    )


def render_opportunity_table(
    opportunities: list[PropertyOpportunity],
    sort_config: Optional[SortConfig] = None,
) -> None:
    if not opportunities:
        st.info('No opportunities to display')
        return

    def sort_indicator(field: SortField) -> str:
        if not sort_config or sort_config.field != field:
            return ''
        arrow = '↑' if sort_config.direction == 'asc' else '↓'
        return f' {arrow}'

    rows_html = []
    for opp in opportunities:
        cap_class = 'cap-good' if opp.cap_rate >= 0.1 else 'cap-bad'
        bg = _STATUS_ROW_BG[opp.status]
        listing = html.escape(opp.listing_url, quote=True)
        rows_html.append(
            f'<tr style="background:{bg}">'
            f'<td><strong>{html.escape(opp.address)}</strong></td>'
            f'<td style="color:#6b7280">{html.escape(opp.location)}</td>'
            f'<td class="num">{_field_value_html(opp.purchase_price)}</td>'
            f'<td class="num">{_field_value_html(opp.monthly_rent)}</td>'
            f'<td class="num noi-value">{html.escape(format_currency(opp.noi))}</td>'
            f'<td class="num {cap_class}">{html.escape(format_percent(opp.cap_rate))}</td>'
            f'<td class="num">{_field_value_html(opp.hoa)}</td>'
            f'<td class="num">{_field_value_html(opp.assessment)}</td>'
            f'<td class="center">{_confidence_badge(opp.confidence)}</td>'
            f'<td class="center">{_status_badge(opp.status)}</td>'
            f'<td class="center"><a href="{listing}" target="_blank" rel="noopener noreferrer">🔗</a></td>'
            f'</tr>'
        )

    table_html = (
        '<div class="opp-table-wrap"><table class="opp-table">'
        '<thead><tr>'
        '<th>Property</th><th>Location</th>'
        '<th class="num">Price</th><th class="num">Rent</th>'
        f'<th class="num">NOI{sort_indicator("noi")}</th>'
        f'<th class="num">Cap Rate{sort_indicator("cap_rate")}</th>'
        '<th class="num">HOA</th><th class="num">Assessments</th>'
        f'<th class="center">Confidence{sort_indicator("confidence")}</th>'
        f'<th class="center">Status{sort_indicator("status")}</th>'
        '<th class="center">Link</th>'
        '</tr></thead><tbody>'
        + ''.join(rows_html)
        + '</tbody></table></div>'
    )
    st.markdown(table_html, unsafe_allow_html=True)


def _opportunity_card(opp: PropertyOpportunity) -> None:
    border = _STATUS_BORDER[opp.status]
    cap_class = 'cap-good' if opp.cap_rate >= 0.1 else 'cap-bad'
    listing = html.escape(opp.listing_url, quote=True)

    st.markdown(
        f'<div style="border-left:4px solid {border}; padding-left:0.25rem;">',
        unsafe_allow_html=True,
    )
    with st.container(border=True):
        header_cols = st.columns([4, 1])
        with header_cols[0]:
            st.markdown(f'<p class="card-title">{html.escape(opp.address)}</p>', unsafe_allow_html=True)
            st.markdown(f'<p class="card-subtitle">{html.escape(opp.location)}</p>', unsafe_allow_html=True)
        with header_cols[1]:
            st.markdown(_status_badge(opp.status), unsafe_allow_html=True)

        st.markdown(
            f"""
<div class="metric-grid">
  <div>
    <div class="metric-label">Price</div>
    <div class="metric-value">{_field_value_html(opp.purchase_price)}</div>
  </div>
  <div>
    <div class="metric-label">Monthly Rent</div>
    <div class="metric-value">{_field_value_html(opp.monthly_rent)}</div>
  </div>
  <div>
    <div class="metric-label">NOI</div>
    <div class="metric-value noi-value">{html.escape(format_currency(opp.noi))}</div>
  </div>
  <div>
    <div class="metric-label">Cap Rate</div>
    <div class="metric-value {cap_class}" style="font-size:1.125rem">{html.escape(format_percent(opp.cap_rate))}</div>
  </div>
  <div>
    <div class="metric-label">HOA</div>
    <div class="metric-value">{_field_value_html(opp.hoa)}<span style="color:#9ca3af;font-size:0.75rem">/mo</span></div>
  </div>
  <div>
    <div class="metric-label">Assessments</div>
    <div class="metric-value">{_field_value_html(opp.assessment)}</div>
  </div>
</div>
<div class="card-footer">
  <span>{_confidence_badge(opp.confidence)}</span>
  <a href="{listing}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;font-size:0.875rem;text-decoration:none">View Listing →</a>
</div>
            """,
            unsafe_allow_html=True,
        )


def render_opportunity_cards(opportunities: list[PropertyOpportunity]) -> None:
    if not opportunities:
        st.info('No opportunities to display')
        return

    for row_start in range(0, len(opportunities), CARD_COLUMNS):
        cols = st.columns(CARD_COLUMNS, gap='medium')
        for offset, col in enumerate(cols):
            index = row_start + offset
            if index >= len(opportunities):
                break
            with col:
                _opportunity_card(opportunities[index])
