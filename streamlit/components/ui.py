"""Streamlit UI components — RealEstateTracker card patterns + React data parity."""

from __future__ import annotations

import html
from collections import defaultdict
from typing import Optional

import streamlit as st

from db_client.types import ConfidenceLevel, FieldValue, PropertyOpportunity, PropertyStatus
from sorting import SortConfig, SortField

CARD_COLUMNS = 3

_PROPERTY_EMOJI = {
    'condo': '🏢',
    'single_family': '🏡',
    'multi_family': '🏬',
    'townhouse': '🏘️',
    'commercial': '🏭',
    'other': '📍',
}

_STATUS_ROW_BG = {
    'VIABLE': '#f0fdf4',
    'WATCHLIST': '#fffbeb',
    'REJECTED': '#fef2f2',
}

_STATUS_PILL = {
    'VIABLE': 'success',
    'WATCHLIST': 'warning',
    'REJECTED': 'danger',
}

_CONFIDENCE_PILL = {
    'HIGH': 'success',
    'MEDIUM': 'muted',
    'LOW': 'warning',
}


def inject_global_styles() -> None:
    st.markdown(
        """
<style>
  .block-container { padding-top: 1.5rem; padding-bottom: 2rem; max-width: 1400px; }
  .app-header { margin-bottom: 1.25rem; }
  .app-title { margin: 0; font-size: 1.5rem; font-weight: 700; color: #0f172a; }
  .app-subtitle { margin: 0.25rem 0 0; color: #64748b; font-size: 0.875rem; }
  .ranking-footer {
    margin-top: 2rem;
    padding: 1rem 0;
    text-align: center;
    color: #94a3b8;
    font-size: 0.75rem;
  }
  div[data-testid="stVerticalBlockBorderWrapper"]:has(.opp-card-marker) {
    border-radius: 14px !important;
    border-color: #e2e8f0 !important;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
    transition: box-shadow 0.2s ease;
    padding: 0.85rem !important;
  }
  div[data-testid="stVerticalBlockBorderWrapper"]:has(.opp-card-marker):hover {
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
  }
  div[data-testid="stHorizontalBlock"]:has(div[data-testid="stVerticalBlockBorderWrapper"]:has(.opp-card-marker)) {
    align-items: stretch !important;
  }
  div[data-testid="stHorizontalBlock"]:has(div[data-testid="stVerticalBlockBorderWrapper"]:has(.opp-card-marker)) > div[data-testid="column"] {
    display: flex !important;
    flex-direction: column !important;
  }
  div[data-testid="stHorizontalBlock"]:has(div[data-testid="stVerticalBlockBorderWrapper"]:has(.opp-card-marker)) div[data-testid="stVerticalBlockBorderWrapper"]:has(.opp-card-marker) {
    flex: 1 1 auto !important;
    width: 100% !important;
    min-height: 0 !important;
    display: flex !important;
    flex-direction: column !important;
  }
  div[data-testid="stVerticalBlockBorderWrapper"]:has(.opp-card-marker) div[data-testid="stMarkdown"]:has(.card-footer-block) {
    margin-top: auto !important;
  }
  div[data-testid="stVerticalBlockBorderWrapper"]:has(.opp-card-marker) div[data-testid="stHorizontalBlock"]:last-of-type {
    margin-top: 0.35rem;
    gap: 0.35rem;
  }
  div[data-testid="stVerticalBlockBorderWrapper"]:has(.opp-card-marker) div[data-testid="stHorizontalBlock"]:last-of-type button {
    white-space: nowrap;
    font-size: 0.82rem;
  }
  .card-title {
    font-size: 1rem;
    font-weight: 650;
    line-height: 1.35;
    margin: 0;
    color: #0f172a;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 2.7em;
  }
  .card-subtitle { font-size: 0.78rem; color: #64748b; margin-top: 0.1rem; line-height: 1.35; }
  .card-media {
    height: 148px;
    width: 100%;
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 0.7rem;
    background: linear-gradient(135deg, #e2e8f0 0%, #f8fafc 55%, #dbeafe 100%);
    flex-shrink: 0;
  }
  .card-media img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .card-media-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.2rem;
  }
  .card-media-duo {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    height: 148px;
    width: 100%;
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 0.7rem;
    flex-shrink: 0;
  }
  .card-media-duo .card-media {
    height: 100%;
    margin-bottom: 0;
    border-radius: 0;
  }
  .section-country {
    font-size: 1.35rem;
    font-weight: 700;
    color: #0f172a;
    margin: 1.75rem 0 0.75rem;
    padding-bottom: 0.35rem;
    border-bottom: 2px solid #2563eb;
  }
  .section-country:first-of-type { margin-top: 0.5rem; }
  .accordion-toggle { margin: 0.35rem 0 0.75rem; }
  .accordion-panel { margin-bottom: 1.25rem; }
  .financial-tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    margin: 0.3rem 0 0.35rem;
  }
  .card-price {
    font-size: 1rem;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.2;
  }
  .badge-row { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.35rem; }
  .pill {
    display: inline-block;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .pill-muted { background: #f1f5f9; color: #475569; }
  .pill-success { background: #dcfce7; color: #166534; }
  .pill-warning { background: #fef3c7; color: #92400e; }
  .pill-danger { background: #fee2e2; color: #991b1b; }
  .pill-rent { background: #dbeafe; color: #1d4ed8; text-transform: none; }
  .pill-cap { background: #dcfce7; color: #166534; text-transform: none; }
  .pill-cap-missing { background: #fef3c7; color: #92400e; text-transform: none; }
  .metric-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.45rem;
    margin: 0.45rem 0 0.65rem;
  }
  .metric-chip {
    background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 0.45rem 0.55rem;
    min-height: 3.1rem;
  }
  .metric-chip-label {
    display: block;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 0.15rem;
  }
  .metric-chip-value {
    display: block;
    font-size: 0.92rem;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.25;
  }
  .metric-chip.noi .metric-chip-value { color: #166534; }
  .metric-chip.cap .metric-chip-value { color: #166534; }
  .metric-chip.cap-bad .metric-chip-value { color: #991b1b; }
  .metric-chip.missing {
    background: linear-gradient(180deg, #fffbeb 0%, #ffffff 100%);
    border-color: #fde68a;
  }
  .metric-chip.missing .metric-chip-value { color: #92400e; }
  .card-footer-block { margin-top: 0.3rem; margin-bottom: 0.05rem; }
  .card-footer-link {
    display: block;
    margin-top: 0.5rem;
    color: #2563eb;
    font-size: 0.875rem;
    text-decoration: none;
    font-weight: 500;
  }
  .field-status { margin-left: 0.2rem; font-size: 0.75em; font-weight: 600; }
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
  .confidence-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 500;
    border: 1px solid transparent;
  }
  .noi-value { font-weight: 500; color: #059669; }
  .cap-good { font-weight: 600; color: #059669; }
  .cap-bad { font-weight: 600; color: #dc2626; }
</style>
        """,
        unsafe_allow_html=True,
    )


def format_currency(value: float) -> str:
    return f'${value:,.0f}'


def format_percent(value: float) -> str:
    return f'{value * 100:.1f}%'


def _pill(text: str, tone: str = 'muted') -> str:
    return f'<span class="pill pill-{tone}">{html.escape(text)}</span>'


def _field_value_html(field: FieldValue, *, show_status: bool = True) -> str:
    if field.value is None:
        return '<span style="color:#94a3b8">—</span>'

    formatted = format_currency(field.value)
    if not show_status:
        return html.escape(formatted)

    indicator = {'VERIFIED': '✓', 'ESTIMATED': '~', 'UNKNOWN': '?'}[field.status]
    color = {'VERIFIED': '#16a34a', 'ESTIMATED': '#d97706', 'UNKNOWN': '#94a3b8'}[field.status]
    title = html.escape(field.evidence or f'Status: {field.status}, Confidence: {field.confidence}')
    return (
        f'<span title="{title}">{html.escape(formatted)}'
        f'<span class="field-status" style="color:{color}">{indicator}</span></span>'
    )


def _status_badge(status: PropertyStatus) -> str:
    return _pill(status, _STATUS_PILL[status])


def _confidence_badge(confidence: ConfidenceLevel) -> str:
    return _pill(confidence, _CONFIDENCE_PILL[confidence])


def render_card_header(title: str, subtitle: str | None = None) -> None:
    sub = f'<div class="card-subtitle">{html.escape(subtitle)}</div>' if subtitle else ''
    st.markdown(
        f'<p class="card-title">{html.escape(title)}</p>{sub}',
        unsafe_allow_html=True,
    )


def render_detail_images(
    image_urls: list[str | None],
    *,
    fallback_emoji: str = '🏠',
) -> None:
    """Full-width images for detail pages."""
    urls = [url for url in image_urls if url]
    if not urls:
        st.markdown(
            f'<div class="card-media" style="height:220px;margin-bottom:1rem">'
            f'<div class="card-media-placeholder">{html.escape(fallback_emoji)}</div></div>',
            unsafe_allow_html=True,
        )
        return
    if len(urls) == 1:
        st.image(urls[0], use_column_width=True)
        return
    col1, col2 = st.columns(2, gap='small')
    with col1:
        st.image(urls[0], use_column_width=True)
    with col2:
        st.image(urls[1], use_column_width=True)


def render_card_media(image_url: str | None, *, fallback_emoji: str = '🏠') -> None:
    if image_url:
        safe_url = html.escape(image_url, quote=True)
        st.markdown(
            f'<div class="card-media"><img src="{safe_url}" alt="" loading="lazy" /></div>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            f'<div class="card-media"><div class="card-media-placeholder">{html.escape(fallback_emoji)}</div></div>',
            unsafe_allow_html=True,
        )


def render_card_media_pair(
    image_urls: list[str | None],
    *,
    fallback_emoji: str = '🏠',
) -> None:
    urls = [url for url in image_urls if url]
    if not urls:
        render_card_media(None, fallback_emoji=fallback_emoji)
        return
    if len(urls) == 1:
        render_card_media(urls[0], fallback_emoji=fallback_emoji)
        return
    img1 = html.escape(urls[0], quote=True)
    img2 = html.escape(urls[1], quote=True)
    st.markdown(
        f'<div class="card-media-duo">'
        f'<div class="card-media"><img src="{img1}" alt="" loading="lazy" /></div>'
        f'<div class="card-media"><img src="{img2}" alt="" loading="lazy" /></div>'
        f'</div>',
        unsafe_allow_html=True,
    )


def _property_emoji(opportunity: PropertyOpportunity) -> str:
    if opportunity.property_type:
        return _PROPERTY_EMOJI.get(opportunity.property_type, '🏠')
    return '🏠'


def _metric_chip(label: str, value_html: str, *, kind: str = '', missing: bool = False) -> str:
    chip_class = f'metric-chip {kind}'.strip()
    if missing:
        chip_class += ' missing'
    return (
        f'<div class="{chip_class}"><span class="metric-chip-label">{html.escape(label)}</span>'
        f'<span class="metric-chip-value">{value_html}</span></div>'
    )


def render_opportunity_financial_tags(opp: PropertyOpportunity) -> None:
    parts: list[str] = []
    parts.append(f'<span class="card-price">{_field_value_html(opp.purchase_price)}</span>')
    if opp.monthly_rent.value is not None:
        rent_html = _field_value_html(opp.monthly_rent)
        parts.append(f'<span class="pill pill-rent">Rent {rent_html}/mo</span>')
    cap_tone = 'pill-cap' if opp.cap_rate >= 0.1 else 'pill-cap-missing'
    parts.append(f'<span class="pill {cap_tone}">Cap {html.escape(format_percent(opp.cap_rate))}</span>')
    st.markdown(f'<div class="financial-tags">{"".join(parts)}</div>', unsafe_allow_html=True)


def render_opportunity_metric_grid(opp: PropertyOpportunity) -> None:
    cap_kind = 'cap' if opp.cap_rate >= 0.1 else 'cap-bad'
    hoa_html = _field_value_html(opp.hoa)
    if opp.hoa.value is not None:
        hoa_html = f'{hoa_html}<span style="color:#94a3b8;font-size:0.75rem;font-weight:500">/mo</span>'

    chips = [
        _metric_chip('NOI', html.escape(format_currency(opp.noi)), kind='noi'),
        _metric_chip('Cap Rate', html.escape(format_percent(opp.cap_rate)), kind=cap_kind),
        _metric_chip('HOA', hoa_html, missing=opp.hoa.value is None),
        _metric_chip('Assessments', _field_value_html(opp.assessment), missing=opp.assessment.value is None),
    ]
    st.markdown(f'<div class="metric-grid">{"".join(chips)}</div>', unsafe_allow_html=True)


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
    from navigation import go_building, go_unit, set_context_from_opportunity

    listing = opp.listing_url if opp.listing_url and opp.listing_url != '#' else None

    with st.container(border=True):
        st.markdown('<div class="opp-card-marker"></div>', unsafe_allow_html=True)
        render_card_header(opp.address, opp.location or None)
        render_card_media_pair(
            [opp.image_url, opp.image_url_2],
            fallback_emoji=_property_emoji(opp),
        )
        render_opportunity_financial_tags(opp)
        render_opportunity_metric_grid(opp)
        st.markdown(
            f'<div class="card-footer-block"><div class="badge-row">{_status_badge(opp.status)}{_confidence_badge(opp.confidence)}</div></div>',
            unsafe_allow_html=True,
        )
        action_cols = st.columns(3, gap='small')
        with action_cols[0]:
            if st.button('Unit', key=f'view_unit_{opp.id}', use_container_width=True, type='primary'):
                set_context_from_opportunity(opp)
                go_unit()
        with action_cols[1]:
            if opp.building_id and st.button(
                'Building',
                key=f'view_building_{opp.id}',
                use_container_width=True,
            ):
                set_context_from_opportunity(opp)
                go_building()
        with action_cols[2]:
            if listing:
                st.link_button('Listing', listing, use_container_width=True)


def _section_id(prefix: str, name: str) -> str:
    safe = name.lower().replace(' ', '_').replace('é', 'e')
    return f'{prefix}_{safe}'


def _render_accordion_section(
    label: str,
    section_id: str,
    *,
    open_key: str,
    key_prefix: str,
    render_content,
) -> None:
    """RealEstateTracker-style toggle — content is NOT wrapped in an extra bordered box."""
    is_open = st.session_state.get(open_key) == section_id
    indicator = '▾' if is_open else '▸'
    if st.button(
        f'{indicator} {label}',
        key=f'{key_prefix}_acc_{section_id}',
        use_container_width=True,
        type='secondary',
    ):
        st.session_state[open_key] = None if is_open else section_id
        st.rerun()

    if is_open:
        render_content()


def _group_by_country(
    opportunities: list[PropertyOpportunity],
) -> dict[str, list[PropertyOpportunity]]:
    grouped: dict[str, list[PropertyOpportunity]] = defaultdict(list)
    for opp in opportunities:
        grouped[opp.country or 'Unknown country'].append(opp)
    return grouped


def render_opportunity_cards(
    opportunities: list[PropertyOpportunity],
    *,
    group_by_country: bool = False,
    accordion_key: str = 'cards_open_country',
) -> None:
    if not opportunities:
        st.info('No opportunities to display')
        return

    if not group_by_country:
        card_grid(opportunities, _opportunity_card)
        return

    by_country = _group_by_country(opportunities)
    country_names = sorted(by_country.keys())

    if accordion_key not in st.session_state:
        st.session_state[accordion_key] = _section_id('country', country_names[0])

    if len(country_names) == 1:
        card_grid(by_country[country_names[0]], _opportunity_card)
        return

    for country_name in country_names:
        items = by_country[country_name]
        region_count = len({opp.region for opp in items if opp.region})
        neighborhood_count = len({opp.neighborhood for opp in items if opp.neighborhood})
        label = (
            f'{country_name} · {len(items)} unit{"s" if len(items) != 1 else ""} · '
            f'{region_count} region{"s" if region_count != 1 else ""} · '
            f'{neighborhood_count} neighborhood{"s" if neighborhood_count != 1 else ""}'
        )

        def render_country_cards(country_items=items) -> None:
            card_grid(country_items, _opportunity_card)

        _render_accordion_section(
            label,
            _section_id('country', country_name),
            open_key=accordion_key,
            key_prefix='opp',
            render_content=render_country_cards,
        )


def card_grid(items: list, render_item, columns: int = CARD_COLUMNS) -> None:
    if not items:
        return
    for row_start in range(0, len(items), columns):
        cols = st.columns(columns, gap='medium')
        for offset, col in enumerate(cols):
            index = row_start + offset
            if index >= len(items):
                break
            with col:
                render_item(items[index])
