"""UI components for reviewed listings browse view."""

from __future__ import annotations

import html
import statistics
from typing import Optional

import streamlit as st

from compat import link_button
from reviewed_types import ReviewedListing


def render_reviewed_header() -> None:
    st.markdown(
        """
<div class="app-header">
  <h1 class="app-title">Reviewed Listings</h1>
  <p class="app-subtitle">Scout first-pass estimates — not underwritten opportunities</p>
</div>
        """,
        unsafe_allow_html=True,
    )


def _format_currency(value: float) -> str:
    return f'${value:,.0f}'


def _format_percent(value: Optional[float]) -> str:
    if value is None:
        return '—'
    return f'{value * 100:.1f}%'


def _cap_class(value: Optional[float]) -> str:
    if value is None:
        return ''
    return 'cap-good' if value >= 0.10 else 'cap-bad'


def _location_tags(listing: ReviewedListing) -> str:
    city = html.escape(listing.city)
    country = html.escape(listing.country)
    region = html.escape(listing.region) if listing.region else None
    tags = [
        f'<span class="confidence-pill" style="background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe;">{city}</span>',
        f'<span class="confidence-pill" style="background:#f0fdf4;color:#166534;border-color:#bbf7d0;">{country}</span>',
    ]
    if region:
        tags.append(
            f'<span class="confidence-pill" style="background:#faf5ff;color:#6b21a8;border-color:#e9d5ff;">{region}</span>'
        )
    return ' '.join(tags)


def compute_reviewed_analytics(listings: list[ReviewedListing]) -> dict[str, Optional[float | int]]:
    cap_rates = [item.estimated_cap_rate for item in listings if item.estimated_cap_rate is not None]
    hoas = [item.hoa_monthly for item in listings if item.hoa_monthly is not None]
    price_per_sqft = [
        item.asking_price / item.sqft
        for item in listings
        if item.sqft is not None and item.sqft > 0
    ]

    return {
        'count': len(listings),
        'avg_cap_rate': statistics.mean(cap_rates) if cap_rates else None,
        'median_cap_rate': statistics.median(cap_rates) if cap_rates else None,
        'avg_hoa': statistics.mean(hoas) if hoas else None,
        'avg_price_per_sqft': statistics.mean(price_per_sqft) if price_per_sqft else None,
        'with_cap_rate': len(cap_rates),
        'with_hoa': len(hoas),
        'with_sqft': len(price_per_sqft),
    }


def render_reviewed_analytics(listings: list[ReviewedListing]) -> None:
    stats = compute_reviewed_analytics(listings)
    cols = st.columns(4)
    cols[0].metric('Reviewed', stats['count'])
    cols[1].metric(
        'Avg est. cap rate',
        _format_percent(stats['avg_cap_rate']) if stats['avg_cap_rate'] is not None else '—',
        help=f"Based on {stats['with_cap_rate']} listings with estimates",
    )
    cols[2].metric(
        'Avg HOA',
        _format_currency(stats['avg_hoa']) if stats['avg_hoa'] is not None else '—',
        help=f"Based on {stats['with_hoa']} listings with HOA",
    )
    cols[3].metric(
        'Avg $/sqft',
        _format_currency(stats['avg_price_per_sqft']) if stats['avg_price_per_sqft'] is not None else '—',
        help=f"Based on {stats['with_sqft']} listings with sqft",
    )


def render_reviewed_table(listings: list[ReviewedListing]) -> None:
    rows_html = []
    for listing in listings:
        cap_class = _cap_class(listing.estimated_cap_rate)
        cap_value = _format_percent(listing.estimated_cap_rate)
        hoa_value = _format_currency(listing.hoa_monthly) if listing.hoa_monthly is not None else '—'
        sqft_value = f'{listing.sqft:,.0f}' if listing.sqft is not None else '—'
        beds_value = str(listing.beds) if listing.beds is not None else '—'
        address = html.escape(listing.address)
        listing_url = html.escape(listing.listing_url, quote=True)

        rows_html.append(
            f"""
<tr>
  <td>{address}</td>
  <td>{_location_tags(listing)}</td>
  <td class="num">{_format_currency(listing.asking_price)}</td>
  <td class="num {cap_class}">{cap_value}</td>
  <td class="num">{hoa_value}</td>
  <td class="num">{sqft_value}</td>
  <td class="center">{beds_value}</td>
  <td class="center"><a href="{listing_url}" target="_blank" rel="noopener noreferrer">Source</a></td>
</tr>
            """
        )

    table = f"""
<div class="opp-table-wrap">
  <table class="opp-table">
    <thead>
      <tr>
        <th>Property</th>
        <th>Location</th>
        <th class="num">Price</th>
        <th class="num">Est. Cap</th>
        <th class="num">HOA</th>
        <th class="num">Sqft</th>
        <th class="center">Beds</th>
        <th class="center">Source</th>
      </tr>
    </thead>
    <tbody>
      {''.join(rows_html)}
    </tbody>
  </table>
</div>
    """
    st.markdown(table, unsafe_allow_html=True)


def render_reviewed_cards(listings: list[ReviewedListing]) -> None:
    cols = st.columns(3)
    for index, listing in enumerate(listings):
        with cols[index % 3]:
            cap_class = _cap_class(listing.estimated_cap_rate)
            st.markdown(
                f"""
<div data-testid="stVerticalBlockBorderWrapper">
  <div class="opp-card-marker"></div>
  <div style="padding:0.25rem 0;">
    <strong>{html.escape(listing.address)}</strong>
    <div style="margin:0.35rem 0;">{_location_tags(listing)}</div>
    <div>{_format_currency(listing.asking_price)} · <span class="{cap_class}">Est. cap {_format_percent(listing.estimated_cap_rate)}</span></div>
  </div>
</div>
                """,
                unsafe_allow_html=True,
            )
            link_button('View listing', listing.listing_url, use_container_width=True)
            if listing.notes:
                st.caption(listing.notes)
