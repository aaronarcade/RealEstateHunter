"""UI components for reviewed listings browse view."""

from __future__ import annotations

import statistics
from typing import Optional

import pandas as pd
import streamlit as st

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


def _format_percent(value: Optional[float]) -> str:
    if value is None:
        return '—'
    return f'{value * 100:.1f}%'


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
        f"${stats['avg_hoa']:,.0f}" if stats['avg_hoa'] is not None else '—',
        help=f"Based on {stats['with_hoa']} listings with HOA",
    )
    cols[3].metric(
        'Avg $/sqft',
        f"${stats['avg_price_per_sqft']:,.0f}" if stats['avg_price_per_sqft'] is not None else '—',
        help=f"Based on {stats['with_sqft']} listings with sqft",
    )


def render_reviewed_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Interactive sortable/filterable table. Returns filtered view from widget state when supported."""
    if df.empty:
        st.info('No rows to display.')
        return df

    display_df = df.drop(columns=['id'], errors='ignore')

    event = st.dataframe(
        display_df,
        use_container_width=True,
        hide_index=True,
        on_select='rerun',
        selection_mode='multi-row',
        column_config={
            'address': st.column_config.TextColumn('Property', width='large'),
            'city': st.column_config.TextColumn('City'),
            'region': st.column_config.TextColumn('Region'),
            'country': st.column_config.TextColumn('Country'),
            'asking_price': st.column_config.NumberColumn('Price', format='$%d'),
            'est_cap_pct': st.column_config.NumberColumn(
                'Est. cap %',
                help='Scout first-pass estimate (HOA-adjusted when HOA known)',
                format='%.1f%%',
            ),
            'gross_yield_pct': st.column_config.NumberColumn('Gross yield %', format='%.1f%%'),
            'hoa_monthly': st.column_config.NumberColumn('HOA/mo', format='$%d'),
            'sqft': st.column_config.NumberColumn('Sqft', format='%d'),
            'price_per_sqft': st.column_config.NumberColumn('$/sqft', format='$%.0f'),
            'beds': st.column_config.NumberColumn('Beds', format='%d'),
            'baths': st.column_config.NumberColumn('Baths', format='%.1f'),
            'property_type': st.column_config.TextColumn('Type'),
            'market_id': st.column_config.TextColumn('Market'),
            'listing_url': st.column_config.LinkColumn('Source', display_text='Open listing'),
            'reviewed_at': st.column_config.DatetimeColumn('Reviewed', format='MMM D, YYYY'),
            'notes': st.column_config.TextColumn('Notes', width='large'),
            'latitude': None,
            'longitude': None,
        },
    )

    st.caption(
        'Click column headers to sort. Use the column menu (⋮) to filter. '
        'Select rows to highlight them in charts and map.'
    )

    if event.selection.rows:
        selected = df.iloc[event.selection.rows]
        st.caption(f'{len(selected)} row(s) selected for charts/map below.')
        return selected

    return df


def render_reviewed_charts(df: pd.DataFrame) -> None:
    if df.empty:
        st.info('No data for charts.')
        return

    chart_df = df.dropna(subset=['est_cap_pct'], how='all')
    if chart_df.empty:
        st.info('No listings with estimated cap rate for charts.')
        return

    left, right = st.columns(2)

    with left:
        st.subheader('Est. cap rate by city')
        by_city = (
            chart_df.groupby(['country', 'city'], as_index=False)['est_cap_pct']
            .median()
            .sort_values('est_cap_pct', ascending=False)
        )
        by_city['label'] = by_city['city'] + ' (' + by_city['country'] + ')'
        st.bar_chart(by_city.set_index('label')['est_cap_pct'], height=320)

    with right:
        st.subheader('Price vs est. cap rate')
        scatter = chart_df.dropna(subset=['est_cap_pct']).copy()
        scatter['size'] = scatter['hoa_monthly'].fillna(0).clip(lower=0) + 50
        st.scatter_chart(
            scatter,
            x='asking_price',
            y='est_cap_pct',
            color='country',
            size='size',
            height=320,
        )

    st.subheader('HOA distribution')
    hoa_df = df.dropna(subset=['hoa_monthly'])
    if hoa_df.empty:
        st.caption('No HOA values in the current filter set.')
    else:
        st.bar_chart(
            hoa_df.groupby('city')['hoa_monthly'].median().sort_values(ascending=False),
            height=260,
        )


def _cap_rate_color(cap_pct: float | None) -> str:
    if cap_pct is None:
        return '#94a3b8'
    if cap_pct >= 10:
        return '#059669'
    if cap_pct >= 8:
        return '#d97706'
    return '#dc2626'


def render_reviewed_map(df: pd.DataFrame) -> None:
    st.subheader('Map')
    map_df = df.dropna(subset=['latitude', 'longitude']).copy()
    map_df['map_color'] = map_df['est_cap_pct'].apply(_cap_rate_color)

    if map_df.empty:
        st.info(
            'No mappable coordinates for the current filter set. '
            'Known cities: Panama City Beach, Celebration, Manta, Cuenca, Quito.'
        )
        return

    st.caption(
        f'Showing {len(map_df)} of {len(df)} listings. '
        'Points use city centroids with slight jitter — not exact addresses. '
        'Green ≥10% est. cap, amber ≥8%, red below 8%.'
    )

    st.map(
        map_df,
        latitude='latitude',
        longitude='longitude',
        size=20,
        color='map_color',
        zoom=3 if map_df['country'].nunique() > 1 else 10,
    )

    with st.expander('Map data table'):
        st.dataframe(
            map_df[
                ['address', 'city', 'country', 'asking_price', 'est_cap_pct', 'latitude', 'longitude']
            ],
            use_container_width=True,
            hide_index=True,
        )
