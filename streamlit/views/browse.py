"""Opportunity browse view."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import streamlit as st

from auth import require_auth
from components.ui import (
    inject_global_styles,
    render_app_header,
    render_opportunity_cards,
    render_opportunity_table,
    render_ranking_footer,
)
from compat import sidebar_toggle
from data_loader import LoadResult, load_opportunities
from filters import apply_filters, countries, neighborhoods, regions
from sorting import SortConfig, SortField, get_next_sort_direction, sort_opportunities

require_auth()
inject_global_styles()

use_sample = sidebar_toggle('Use sample data', value=False, help='Offline dev without Supabase credentials')

sort_field_labels: dict[str, SortField | None] = {
    'Default ranking': None,
    'Status': 'status',
    'Confidence': 'confidence',
    'Cap Rate': 'cap_rate',
    'NOI': 'noi',
}
sort_label = st.sidebar.selectbox('Sort by', list(sort_field_labels.keys()), index=0)
selected_field = sort_field_labels[sort_label]

if 'sort_config' not in st.session_state:
    st.session_state.sort_config = None

if selected_field is None:
    st.session_state.sort_config = None
else:
    current = st.session_state.sort_config
    if current is None or current.field != selected_field:
        st.session_state.sort_config = get_next_sort_direction(None, selected_field)
    sort_direction_label = st.sidebar.radio(
        'Sort direction',
        ['Ascending', 'Descending'],
        index=1 if st.session_state.sort_config.direction == 'desc' else 0,
        horizontal=True,
    )
    st.session_state.sort_config = SortConfig(
        field=selected_field,
        direction='desc' if sort_direction_label == 'Descending' else 'asc',
    )

if st.sidebar.button('Refresh data', use_container_width=True):
    st.cache_data.clear()
    st.rerun()


@st.cache_data(show_spinner=False)
def cached_load(use_sample_data: bool) -> tuple[list, str, str | None]:
    result = load_opportunities(use_sample_data=use_sample_data)
    return result.opportunities, result.source, result.error


with st.spinner('Loading opportunities...'):
    opportunities_list, load_source, load_error = cached_load(use_sample)
    result = LoadResult(opportunities=opportunities_list, source=load_source, error=load_error)
    all_opportunities = sort_opportunities(result.opportunities, st.session_state.sort_config)

st.sidebar.markdown('---')
st.sidebar.subheader('Browse')

country_options = ['All'] + countries(all_opportunities)
selected_country = st.sidebar.selectbox('Country', country_options, index=0)

region_options = ['All'] + regions(all_opportunities, None if selected_country == 'All' else selected_country)
selected_region = st.sidebar.selectbox('Region', region_options, index=0)

neighborhood_options = ['All'] + neighborhoods(
    all_opportunities,
    None if selected_country == 'All' else selected_country,
    None if selected_region == 'All' else selected_region,
)
selected_neighborhood = st.sidebar.selectbox('Neighborhood', neighborhood_options, index=0)

status_options = ['All', 'VIABLE', 'WATCHLIST', 'REJECTED']
selected_status = st.sidebar.selectbox('Status', status_options, index=0)

opportunities = apply_filters(
    all_opportunities,
    country=selected_country,
    region=selected_region,
    neighborhood=selected_neighborhood,
    status=selected_status,
)

# Header table/card toggle (React App.tsx parity — default Table)
header_cols = st.columns([3, 2, 1])
with header_cols[0]:
    render_app_header()
with header_cols[1]:
    view_mode = st.radio(
        'View',
        ['Table', 'Cards'],
        horizontal=True,
        key='opp_view_mode',
        help='Toggle table and card layouts (React parity)',
    )
with header_cols[2]:
    st.metric('Showing', len(opportunities))

use_country_accordion = (
    view_mode == 'Cards'
    and selected_country == 'All'
    and selected_region == 'All'
    and selected_neighborhood == 'All'
)

if result.error:
    if result.opportunities:
        st.info(result.error)
    else:
        st.warning(result.error)

if result.source == 'sample' and not use_sample:
    st.info('Showing sample data. Configure Supabase secrets for live RealEstateTracker units.')
elif result.source == 'supabase':
    st.caption(f'{len(opportunities)} of {len(all_opportunities)} units · use sidebar to filter')

if not opportunities:
    st.info('No opportunities match the current filters.')
else:
    if view_mode == 'Table':
        render_opportunity_table(opportunities, st.session_state.sort_config)
    else:
        render_opportunity_cards(opportunities, group_by_country=use_country_accordion)

render_ranking_footer()
