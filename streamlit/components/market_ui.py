"""UI components for market research browse view."""

from __future__ import annotations

import pandas as pd
import streamlit as st

from market_analytics import (
    GROSS_YIELD_TARGET,
    HOA_SCRUTINY_MONTHLY,
    MarketAnalytics,
    baselines_to_rows,
    compute_market_analytics,
    search_beds_min,
    search_price_range,
)
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


def _fmt_currency(value: float | None) -> str:
    return f'${value:,.0f}' if value is not None else '—'


def _fmt_pct(value: float | None) -> str:
    return f'{value:.1f}%' if value is not None else '—'


def render_baseline_cards(analytics: MarketAnalytics) -> None:
    cols = st.columns(5)
    cols[0].metric('Listings', analytics.count)
    cols[1].metric('Median price', _fmt_currency(analytics.median_price))
    cols[2].metric('Median $/sqft', _fmt_currency(analytics.median_price_per_sqft))
    cols[3].metric('Median HOA', _fmt_currency(analytics.median_hoa))
    cols[4].metric(
        f'HOA > ${HOA_SCRUTINY_MONTHLY}',
        _fmt_pct(analytics.pct_hoa_over_500),
        help='Share of listings with HOA above scout scrutiny threshold',
    )


def render_area_comparison(analytics: MarketAnalytics) -> None:
    if len(analytics.baselines_by_area) < 2:
        return

    st.subheader('Market area comparison')
    rows = baselines_to_rows(analytics.baselines_by_area)
    df = pd.DataFrame(rows)
    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
        column_config={
            'Median price': st.column_config.NumberColumn(format='$%d'),
            'Median $/sqft': st.column_config.NumberColumn(format='$%.0f'),
            'Median HOA': st.column_config.NumberColumn(format='$%d'),
            'HOA > $500': st.column_config.NumberColumn(format='%.1f%%'),
            'Median DOM': st.column_config.NumberColumn(format='%.0f'),
            '% Condo': st.column_config.NumberColumn(format='%.1f%%'),
            'In scout price range': st.column_config.NumberColumn(format='%.1f%%'),
        },
    )


def render_investment_signals(analytics: MarketAnalytics) -> None:
    signals = analytics.signals
    price_min, price_max = search_price_range()
    beds_min = search_beds_min()

    st.subheader('Investment signals')
    st.caption(
        f'Based on scout criteria: ${price_min:,.0f}–${price_max:,.0f}, '
        f'{beds_min}+ beds, {int(GROSS_YIELD_TARGET * 100)}% gross yield target.'
    )

    cols = st.columns(4)
    cols[0].metric(
        'Below median $/sqft',
        signals.under_median_price_per_sqft,
        help='Listings priced under the filtered set median $/sqft',
    )
    cols[1].metric(
        'HOA below area median',
        signals.low_hoa_vs_area,
        help='Listings with stated HOA below filtered-set median',
    )
    cols[2].metric(
        f'{beds_min}BR+ in scout range',
        signals.scout_price_range_2br_plus,
        help=f'Price ${price_min:,.0f}–${price_max:,.0f} with {beds_min}+ bedrooms',
    )
    cols[3].metric(
        f'HOA > ${HOA_SCRUTINY_MONTHLY}',
        signals.hoa_over_scrutiny,
        help='Listings flagged for extra HOA scrutiny in scout workflow',
    )


def render_yield_proxy(analytics: MarketAnalytics) -> None:
    st.subheader('Gross yield proxy (no rent data)')
    st.caption(
        f'Estimated monthly rent needed for {int(GROSS_YIELD_TARGET * 100)}% **gross** yield '
        '(before taxes, insurance, management). This is not verified rent — use for baseline setting only.'
    )

    rows = []
    for band in analytics.yield_bands:
        if band.count == 0:
            continue
        rows.append(
            {
                'Price band': band.label,
                'Listings': band.count,
                'Median price': band.median_price,
                'Rent needed (10% gross)': band.median_required_rent,
                'Rent + HOA (10% gross)': band.median_required_rent_after_hoa,
            }
        )

    if not rows:
        st.info('No priced listings in the current filter set.')
        return

    df = pd.DataFrame(rows)
    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
        column_config={
            'Median price': st.column_config.NumberColumn(format='$%d'),
            'Rent needed (10% gross)': st.column_config.NumberColumn(format='$%d'),
            'Rent + HOA (10% gross)': st.column_config.NumberColumn(format='$%d'),
        },
    )


def render_market_analytics(listings: list[MarketListing]) -> None:
    if not listings:
        st.info('No listings match the current filters.')
        return

    analytics = compute_market_analytics(listings)
    render_baseline_cards(analytics)
    render_investment_signals(analytics)
    render_area_comparison(analytics)
    render_yield_proxy(analytics)


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


def render_market_charts(df: pd.DataFrame, analytics: MarketAnalytics | None = None) -> None:
    if df.empty:
        st.info('No data for charts.')
        return

    if analytics is None:
        analytics = compute_market_analytics([])

    left, right = st.columns(2)
    with left:
        st.subheader('Median price by market area')
        by_area = (
            df.dropna(subset=['asking_price'])
            .groupby('market_area', as_index=False)['asking_price']
            .median()
            .sort_values('asking_price', ascending=False)
        )
        if by_area.empty:
            st.caption('No price data by area.')
        else:
            st.bar_chart(by_area.set_index('market_area')['asking_price'], height=320)

    with right:
        st.subheader('Property type mix')
        if analytics.property_type_counts:
            type_df = pd.Series(analytics.property_type_counts).sort_values(ascending=False)
            st.bar_chart(type_df, height=320)
        else:
            st.caption('No property type data.')

    st.subheader('Price distribution by area')
    price_df = df.dropna(subset=['asking_price', 'market_area'])
    if price_df.empty:
        st.caption('No price data in current filter set.')
    else:
        area_medians = price_df.groupby('market_area')['asking_price'].median().sort_values(ascending=False)
        st.bar_chart(area_medians, height=260)

    scatter_left, scatter_right = st.columns(2)
    with scatter_left:
        st.subheader('HOA vs price')
        scatter_df = df.dropna(subset=['asking_price', 'hoa_monthly']).copy()
        if scatter_df.empty:
            st.caption('No listings with both price and HOA.')
        else:
            st.scatter_chart(
                scatter_df,
                x='asking_price',
                y='hoa_monthly',
                color='market_area',
                height=320,
            )

    with scatter_right:
        st.subheader('Days on market by area')
        dom_df = df.dropna(subset=['days_on_market', 'market_area'])
        if dom_df.empty:
            st.caption('No DOM data.')
        else:
            dom_medians = dom_df.groupby('market_area')['days_on_market'].median().sort_values(ascending=False)
            st.bar_chart(dom_medians, height=320)


def render_market_map(df: pd.DataFrame) -> None:
    st.subheader('Map')
    map_df = df.dropna(subset=['latitude', 'longitude']).copy()
    if map_df.empty:
        st.info('No coordinates in this dataset. Re-sync after a scrape that includes lat/lng.')
        return

    st.caption(f'Showing {len(map_df)} of {len(df)} listings with coordinates.')
    st.map(map_df, latitude='latitude', longitude='longitude', size=20, zoom=9)
