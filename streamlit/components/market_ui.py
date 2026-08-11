"""UI components for market research browse view."""

from __future__ import annotations

import pandas as pd
import pydeck as pdk
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


def _hex_to_rgb(hex_color: str) -> list[int]:
    color = hex_color.lstrip('#')
    return [int(color[i : i + 2], 16) for i in (0, 2, 4)]


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


def render_city_baselines(analytics: MarketAnalytics) -> None:
    if not analytics.baselines_by_city:
        return

    st.subheader('City baselines')
    st.caption(
        'Empirical medians from the current filter set, grouped by city. '
        'Cap rate medians use verified pipeline matches where available, otherwise estimated proxies.'
    )
    df = pd.DataFrame(analytics.baselines_by_city)
    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
        column_config={
            'Median price': st.column_config.NumberColumn(format='$%d'),
            'Median $/sqft': st.column_config.NumberColumn(format='$%.0f'),
            'Median HOA': st.column_config.NumberColumn(format='$%d'),
            'Median cap rate': st.column_config.NumberColumn(format='%.2%%'),
            'Median NOI/sqft': st.column_config.NumberColumn(format='$%.2f'),
        },
    )


def render_deals_vs_baseline(analytics: MarketAnalytics) -> None:
    deals = analytics.deals_vs_baseline
    if not deals:
        return

    st.subheader('Deals vs city baseline')
    st.caption(
        'Counts relative to each listing\'s city median in the current filter set. '
        'Green map points: cap rate above city median or $/sqft below city median.'
    )
    cols = st.columns(3)
    cols[0].metric(
        'Below city median $/sqft',
        deals.get('below_median_ppsf', 0),
        help='Listings priced under their city\'s median $/sqft',
    )
    cols[1].metric(
        'Above city median cap rate',
        deals.get('above_median_cap_rate', 0),
        help='Cap rate above city median (verified or estimated)',
    )
    cols[2].metric(
        'Above city median NOI/sqft',
        deals.get('above_median_noi_sqft', 0),
        help='Annual NOI per sqft above city median',
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


def render_market_analytics(listings: list[MarketListing], analytics: MarketAnalytics | None = None) -> None:
    if not listings:
        st.info('No listings match the current filters.')
        return

    if analytics is None:
        analytics = compute_market_analytics(listings)
    render_baseline_cards(analytics)
    render_deals_vs_baseline(analytics)
    render_city_baselines(analytics)
    render_investment_signals(analytics)
    render_area_comparison(analytics)
    render_yield_proxy(analytics)


def render_market_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        st.info('No rows to display.')
        return df

    display_df = df.drop(columns=['id', 'map_color'], errors='ignore')
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
            'cap_rate_pct': st.column_config.NumberColumn(
                'Cap rate',
                format='%.2f%%',
                help='Verified from pipeline match (reviewed/properties) or ESTIMATED proxy (10% gross yield minus HOA)',
            ),
            'cap_rate_source': st.column_config.TextColumn(
                'Cap source',
                help='VERIFIED_REVIEWED, VERIFIED_PROPERTY, or ESTIMATED (scout-style proxy)',
            ),
            'noi_per_sqft': st.column_config.NumberColumn(
                'NOI/sqft',
                format='$%.2f',
                help='Annual NOI per sqft: (cap rate × price) / sqft, or verified NOI / sqft',
            ),
            'price_vs_city_median_pct': st.column_config.NumberColumn(
                'Price vs city',
                format='%.1f%%',
                help='Percent above/below city median asking price',
            ),
            'sqft_price_vs_city_median_pct': st.column_config.NumberColumn(
                '$/sqft vs city',
                format='%.1f%%',
                help='Percent above/below city median $/sqft',
            ),
            'cap_rate_vs_city_median_bps': st.column_config.NumberColumn(
                'Cap vs city (bps)',
                format='%.0f',
                help='Cap rate delta vs city median in basis points',
            ),
            'noi_per_sqft_vs_city_median_pct': st.column_config.NumberColumn(
                'NOI/sqft vs city',
                format='%.1f%%',
            ),
            'beds': st.column_config.NumberColumn('Beds', format='%d'),
            'baths': st.column_config.NumberColumn('Baths', format='%.1f'),
            'property_type': st.column_config.TextColumn('Type'),
            'days_on_market': st.column_config.NumberColumn('DOM', format='%d'),
            'mls_id': st.column_config.TextColumn('MLS'),
            'listing_url': st.column_config.LinkColumn('Source', display_text='Open listing'),
            'latitude': None,
            'longitude': None,
            'scraped_at': None,
            'cap_rate': None,
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
        st.subheader('Cap rate vs $/sqft')
        cap_df = df.dropna(subset=['cap_rate_pct', 'price_per_sqft']).copy()
        if cap_df.empty:
            st.caption('No cap rate and $/sqft data.')
        else:
            st.scatter_chart(
                cap_df,
                x='price_per_sqft',
                y='cap_rate_pct',
                color='cap_rate_source',
                height=320,
            )


def render_market_map(df: pd.DataFrame) -> None:
    st.subheader('Map')
    map_df = df.dropna(subset=['latitude', 'longitude']).copy()
    if map_df.empty:
        st.info('No coordinates in this dataset. Re-sync after a scrape that includes lat/lng.')
        return

    st.caption(
        'Interactive map — hover for details. '
        'Green: cap rate above city median or $/sqft below city median. '
        'Amber: near baseline. Red: below cap median or above $/sqft median.'
    )

    map_df['color_rgb'] = map_df['map_color'].fillna('#94a3b8').apply(_hex_to_rgb)
    map_df['cap_display'] = map_df['cap_rate_pct'].apply(
        lambda value: f'{value:.1f}%' if pd.notna(value) else '—'
    )
    map_df['price_display'] = map_df['asking_price'].apply(
        lambda value: f'${value:,.0f}' if pd.notna(value) else '—'
    )
    map_df['ppsf_display'] = map_df['price_per_sqft'].apply(
        lambda value: f'${value:,.0f}' if pd.notna(value) else '—'
    )

    center_lat = float(map_df['latitude'].median())
    center_lng = float(map_df['longitude'].median())

    layer = pdk.Layer(
        'ScatterplotLayer',
        data=map_df,
        get_position='[longitude, latitude]',
        get_fill_color='color_rgb',
        get_radius=120,
        pickable=True,
        opacity=0.85,
    )

    view_state = pdk.ViewState(
        latitude=center_lat,
        longitude=center_lng,
        zoom=10,
        pitch=0,
    )

    tooltip = {
        'html': (
            '<b>{address}</b><br/>'
            '{city}, {state}<br/>'
            'Price: {price_display}<br/>'
            '$/sqft: {ppsf_display}<br/>'
            'Cap rate: {cap_display} ({cap_rate_source})<br/>'
            '<a href="{listing_url}" target="_blank">Open listing</a>'
        ),
        'style': {'backgroundColor': '#1e293b', 'color': '#f8fafc', 'fontSize': '12px'},
    }

    st.pydeck_chart(
        pdk.Deck(layers=[layer], initial_view_state=view_state, tooltip=tooltip),
        use_container_width=True,
    )
