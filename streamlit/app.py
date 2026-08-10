"""RealEstateHunter Streamlit opportunity comparison UI."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import streamlit as st

from auth import logout_button, require_auth
from components.ui import (
    inject_global_styles,
    render_app_header,
    render_opportunity_cards,
    render_opportunity_table,
    render_ranking_footer,
)
from data_loader import load_opportunities
from sorting import SortConfig, SortField, get_next_sort_direction, sort_opportunities

st.set_page_config(
    page_title='RealEstateHunter',
    page_icon='🏠',
    layout='wide',
    initial_sidebar_state='expanded',
)

require_auth()
inject_global_styles()

st.sidebar.title('RealEstateHunter')
st.sidebar.caption('Investment Opportunities')
logout_button()

use_sample = st.sidebar.toggle('Use sample data', value=False, help='Offline dev without Supabase credentials')

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

view_mode = st.sidebar.radio('View', ['Table', 'Cards'], horizontal=True)

if st.sidebar.button('Refresh data', use_container_width=True):
    st.cache_data.clear()
    st.rerun()


@st.cache_data(show_spinner=False)
def cached_load(use_sample_data: bool):
    return load_opportunities(use_sample_data=use_sample_data)


with st.spinner('Loading opportunities...'):
    result = cached_load(use_sample)
    opportunities = sort_opportunities(result.opportunities, st.session_state.sort_config)

header_cols = st.columns([3, 1])
with header_cols[0]:
    render_app_header()
with header_cols[1]:
    st.metric('Opportunities', len(opportunities))

if result.error:
    st.warning(result.error)

if result.source == 'sample' and not use_sample:
    st.info('Showing sample data. Configure Supabase secrets for live RealEstateTracker units.')
elif result.source == 'supabase':
    st.caption(f'Loaded {len(opportunities)} units from Supabase.')

if not opportunities:
    st.info('No opportunities found')
else:
    if view_mode == 'Table':
        render_opportunity_table(opportunities, st.session_state.sort_config)
    else:
        render_opportunity_cards(opportunities)

render_ranking_footer()
