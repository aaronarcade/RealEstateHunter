"""Unit detail view."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import streamlit as st

from auth import require_auth
from compat import link_button
from components.building_display import building_card_subtitle, building_nav_label
from components.ui import inject_global_styles, render_detail_images, render_opportunity_financial_tags
from components.unit_detail import inject_detail_styles, primary_source, render_unit_details
from db import select_by_id, table
from db_client.tracker_mapper import tracker_financials_to_opportunity
from navigation import PAGE_BROWSE, PAGE_BUILDING, go_building, render_breadcrumb, require_unit, set_building

require_auth()
inject_global_styles()

unit_id = require_unit()
unit = select_by_id('units', unit_id)
if not unit:
    st.error('Unit not found.')
    st.stop()

building = select_by_id('buildings', unit['building_id'])
building_label = building_nav_label(building) if building else 'Building'
set_building(unit['building_id'], building_label)

render_breadcrumb(
    ('Opportunities', PAGE_BROWSE),
    (building_label, PAGE_BUILDING),
    (f"Unit {unit['unit_number']}", None),
)

st.title(f"Unit {unit['unit_number']}")
if building:
    st.caption(building_card_subtitle(building) or building.get('address', ''))

try:
    financials_response = (
        table('unit_financials')
        .select('*')
        .eq('unit_id', unit_id)
        .maybe_single()
        .execute()
    )
    financials = financials_response.data if financials_response is not None else None
except Exception:
    financials = None

try:
    sources_response = (
        table('data_sources')
        .select('*')
        .eq('entity_type', 'unit')
        .eq('entity_id', unit_id)
        .order('source_date', desc=True)
        .execute()
    )
    sources = sources_response.data if sources_response is not None else []
except Exception:
    sources = []

primary = primary_source(sources)
link_cols = st.columns([1, 1, 2])
with link_cols[0]:
    if st.button('View building', use_container_width=True):
        go_building()
if primary and primary.get('source_url'):
    source_label = (primary.get('source_type') or 'source').replace('_', ' ').title()
    with link_cols[1]:
        link_button(f'View on {source_label}', primary['source_url'], use_container_width=True)

if financials:
    opp = tracker_financials_to_opportunity(financials, building=building, source_url=primary.get('source_url') if primary else None)
    render_opportunity_financial_tags(opp)

image_urls = [
    unit.get('image_url') or (building or {}).get('image_url'),
    unit.get('image_url_2') or (building or {}).get('image_url_2'),
]
render_detail_images(image_urls, fallback_emoji='🏠')

inject_detail_styles()
st.markdown('<div class="unit-detail-col-start"></div>', unsafe_allow_html=True)
left_col, right_col = st.columns(2, gap='large')
with left_col:
    render_unit_details(unit, building or {}, financials, sources, column='left')
with right_col:
    render_unit_details(unit, building or {}, financials, sources, column='right')
