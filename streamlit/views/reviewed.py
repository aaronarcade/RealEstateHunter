"""Reviewed listings browse view."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import streamlit as st

from auth import require_auth
from components.reviewed_ui import (
    render_reviewed_analytics,
    render_reviewed_cards,
    render_reviewed_header,
    render_reviewed_table,
)
from components.ui import inject_global_styles
from compat import sidebar_toggle
from reviewed_filters import (
    apply_reviewed_filters,
    reviewed_cities,
    reviewed_countries,
    reviewed_markets,
    reviewed_property_types,
)
from reviewed_loader import ReviewedLoadResult, load_reviewed_listings

require_auth()
inject_global_styles()

use_sample = sidebar_toggle(
    'Use sample data',
    value=False,
    help='Offline dev without Supabase credentials',
)

view_mode = st.sidebar.radio('View', ['Table', 'Cards'], horizontal=True)

if st.sidebar.button('Refresh data', use_container_width=True):
    st.cache_data.clear()
    st.rerun()


@st.cache_data(show_spinner=False)
def cached_load(use_sample_data: bool) -> tuple[list, str, str | None]:
    result = load_reviewed_listings(use_sample_data=use_sample_data)
    return result.listings, result.source, result.error


with st.spinner('Loading reviewed listings...'):
    listings_list, load_source, load_error = cached_load(use_sample)
    result = ReviewedLoadResult(listings=listings_list, source=load_source, error=load_error)

st.sidebar.markdown('---')
st.sidebar.subheader('Filters')

country_options = ['All'] + reviewed_countries(result.listings)
selected_country = st.sidebar.selectbox('Country', country_options, index=0)

city_options = ['All'] + reviewed_cities(
    result.listings,
    None if selected_country == 'All' else selected_country,
)
selected_city = st.sidebar.selectbox('City', city_options, index=0)

market_options = ['All'] + reviewed_markets(result.listings)
selected_market = st.sidebar.selectbox('Market', market_options, index=0)

type_options = ['All'] + reviewed_property_types(result.listings)
selected_type = st.sidebar.selectbox('Property type', type_options, index=0)

cap_min_pct = st.sidebar.slider('Min est. cap rate (%)', 0.0, 25.0, 0.0, 0.5)
cap_max_pct = st.sidebar.slider('Max est. cap rate (%)', 0.0, 30.0, 30.0, 0.5)

listings = apply_reviewed_filters(
    result.listings,
    country=selected_country,
    city=selected_city,
    market_id=selected_market,
    property_type=selected_type,
    min_cap_rate=cap_min_pct / 100 if cap_min_pct > 0 else None,
    max_cap_rate=cap_max_pct / 100 if cap_max_pct < 30 else None,
)

header_cols = st.columns([3, 1])
with header_cols[0]:
    render_reviewed_header()
with header_cols[1]:
    st.metric('Showing', len(listings))

if result.error:
    if result.listings:
        st.info(result.error)
    else:
        st.warning(result.error)

if result.source == 'sample' and not use_sample:
    st.info('Showing sample data. Configure Supabase or run backfill for live reviewed listings.')
elif result.source in {'supabase', 'ndjson'}:
    st.caption(f'{len(listings)} of {len(result.listings)} reviewed listings')

render_reviewed_analytics(listings)

if not listings:
    st.info('No reviewed listings match the current filters.')
else:
    if view_mode == 'Table':
        render_reviewed_table(listings)
    else:
        render_reviewed_cards(listings)

st.markdown(
    """
<div class="ranking-footer">
  <p>Est. cap rate uses scout first-pass rent and HOA when available — not full underwriting.</p>
  <p>Data source: reviewed_listings (Supabase) or data/reviewed/listings.ndjson (Git)</p>
</div>
    """,
    unsafe_allow_html=True,
)
