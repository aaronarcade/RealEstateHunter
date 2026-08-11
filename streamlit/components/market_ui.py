"""UI components for market research browse view."""

from __future__ import annotations

import statistics

import pandas as pd
import streamlit as st

from market_types import MarketListing


def render_market_header(scraped_at: str | None = None) -> None:
    subtitle = 'Bulk active listings — raw market inventory, not screened or underwritten'
    if scraped_at:
        subtitle += f' · scraped {scraped_at[:10]}'
    st.markdown(
        f"""
<div class="app-header">
  <h1 class="app-title">Market Research</h1>
  <p class="app-subtitle">{subtitle}</p>
</div>
        """,
        unsafe_allow_html=True,
    )


def compute_market_analytics(listings: list[MarketListing]) -> dict:
    prices = [item.asking_price for item in listings if item.asking_price is not None]
    hoas = [item.hoa_monthly for item in listings if item.hoa_monthly is not None]
    price_per_sqft = [
        item.asking_price / item.sqft
        for item in listings
        if item.asking_price and item.sqft and item.sqft > 0
    ]
    return {
        'count': len(listings),
        'median_price': statistics.median(prices) if prices else None,
        'avg_hoa': statistics.mean(hoas) if hoas else None,
        'avg_price_per_sqft': statistics.mean(price_per_sqft) if price_per_sqft else None,
        'with_hoa': len(hoas),
    }


def render_market_analytics(listings: list[MarketListing]) -> None:
    stats = compute_market_analytics(listings)
    cols = st.columns(4)
    cols[0].metric('Listings', stats['count'])
    cols[1].metric(
        'Median price',
        f"${stats['median_price']:,.0f}" if stats['median_price'] is not None else '—',
    )
    cols[2].metric(
        'Avg HOA',
        f"${stats['avg_hoa']:,.0f}" if stats['avg_hoa'] is not None else '—',
        help=f"Based on {stats['with_hoa']} listings with HOA",
    )
    cols[3].metric(
        'Avg $/sqft',
        f"${stats['avg_price_per_sqft']:,.0f}" if stats['avg_price_per_sqft'] is not None else '—',
    )


def render_market_dataframe(df: pd.DataFrame) -> pd.DataFrame:
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
            'state': st.column_config.TextColumn('State'),
            'zip': st.column_config.TextColumn('ZIP'),
            'market_area': st.column_config.TextColumn('Market area'),
            'asking_price': st.column_config.NumberColumn('Price', format='$%d'),
            'hoa_monthly': st.column_config.NumberColumn('HOA/mo', format='$%d'),
            'sqft': st.column_config.NumberColumn('Sqft', format='%d'),
            'price_per_sqft': st.column_config.NumberColumn('$/sqft', format='$%.0f'),
            'beds': st.column_config.NumberColumn('Beds', format='%d'),
            'baths': st.column_config.NumberColumn('Baths', format='%.1f'),
            'property_type': st.column_config.TextColumn('Type'),
            'days_on_market': st.column_config.NumberColumn('DOM', format='%d'),
            'mls_id': st.column_config.TextColumn('MLS'),
            'listing_url': st.column_config.LinkColumn('Source', display_text='Open listing'),
            'latitude': None,
            'longitude': None,
            'scraped_at': None,
        },
    )

    if event.selection.rows:
        return df.iloc[event.selection.rows]
    return df


def render_market_charts(df: pd.DataFrame) -> None:
    if df.empty:
        st.info('No data for charts.')
        return

    left, right = st.columns(2)
    with left:
        st.subheader('Median price by market area')
        by_area = (
            df.dropna(subset=['asking_price'])
            .groupby('market_area', as_index=False)['asking_price']
            .median()
            .sort_values('asking_price', ascending=False)
        )
        st.bar_chart(by_area.set_index('market_area')['asking_price'], height=320)

    with right:
        st.subheader('Listings by city (top 15)')
        by_city = df['city'].value_counts().head(15)
        st.bar_chart(by_city, height=320)

    st.subheader('Price distribution')
    price_df = df.dropna(subset=['asking_price'])
    if price_df.empty:
        st.caption('No price data in current filter set.')
    else:
        st.bar_chart(
            price_df.groupby('property_type', dropna=False)['asking_price'].median().sort_values(ascending=False),
            height=260,
        )


def render_market_map(df: pd.DataFrame) -> None:
    st.subheader('Map')
    map_df = df.dropna(subset=['latitude', 'longitude']).copy()
    if map_df.empty:
        st.info('No coordinates in this dataset. Re-sync after a scrape that includes lat/lng.')
        return

    st.caption(f'Showing {len(map_df)} of {len(df)} listings with coordinates.')
    st.map(map_df, latitude='latitude', longitude='longitude', size=20, zoom=9)
