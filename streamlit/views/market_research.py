"""Market research browse view — bulk scraped inventory."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import streamlit as st

from auth import require_auth
from components.market_ui import (
    render_market_analytics,
    render_market_charts,
    render_market_dataframe,
    render_market_header,
    render_market_map,
)
from market_analytics import compute_market_analytics
from components.ui import inject_global_styles
from market_dataframe import listings_to_dataframe
from market_filters import apply_market_filters, market_areas, market_cities, property_types
from market_loader import load_market_listings

require_auth()
inject_global_styles()

if st.sidebar.button('Refresh market data', use_container_width=True):
    st.cache_data.clear()
    st.rerun()


@st.cache_data(show_spinner=False)
def cached_load() -> tuple[list, str, str | None]:
    result = load_market_listings()
    return result.listings, result.source, result.error


with st.spinner('Loading market listings...'):
    listings_list, load_source, load_error = cached_load()

scraped_at = listings_list[0].scraped_at if listings_list else None
render_market_header(scraped_at)

st.sidebar.markdown('---')
st.sidebar.subheader('Filters')

area_options = ['All'] + market_areas(listings_list)
selected_area = st.sidebar.selectbox('Market area', area_options, index=0)

city_options = ['All'] + market_cities(listings_list, selected_area)
selected_city = st.sidebar.selectbox('City', city_options, index=0)

type_options = ['All'] + property_types(listings_list)
selected_type = st.sidebar.selectbox('Property type', type_options, index=0)

price_min = st.sidebar.number_input('Min price ($)', min_value=0, value=0, step=25000)
price_max = st.sidebar.number_input('Max price ($)', min_value=0, value=0, step=25000)

listings = apply_market_filters(
    listings_list,
    market_area=selected_area,
    city=selected_city,
    property_type=selected_type,
    min_price=price_min if price_min > 0 else None,
    max_price=price_max if price_max > 0 else None,
)

header_cols = st.columns([3, 1])
with header_cols[1]:
    st.metric('Showing', len(listings))

if load_error:
    st.info(load_error)
elif load_source == 'scrape':
    st.caption('Showing local scrape file. Run sync script to load Supabase.')
elif load_source == 'supabase':
    st.caption(f'{len(listings)} of {len(listings_list)} market listings from Supabase')

render_market_analytics(listings)

if not listings:
    st.info('No listings match the current filters.')
else:
    df = listings_to_dataframe(listings)
    analytics = compute_market_analytics(listings)
    table_tab, charts_tab, map_tab = st.tabs(['Table', 'Charts', 'Map'])

    active_df = df
    with table_tab:
        active_df = render_market_dataframe(df)
    with charts_tab:
        render_market_charts(active_df, analytics)
    with map_tab:
        render_market_map(active_df)

st.markdown(
    """
<div class="ranking-footer">
  <p>Market research tier: raw Redfin inventory. Not scout-screened or underwritten.</p>
  <p>Pipeline opportunities and reviewed listings live on separate pages.</p>
</div>
    """,
    unsafe_allow_html=True,
)
