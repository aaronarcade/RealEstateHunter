"""Building detail view."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import streamlit as st

from auth import require_auth
from components.building_display import building_nav_label
from components.financial_metrics import feasibility_badge, format_currency, format_pct
from components.ui import card_grid, inject_global_styles, render_card_media, render_card_header, render_card_media_pair, render_opportunity_financial_tags, render_opportunity_metric_grid, _status_badge, _confidence_badge, _property_emoji
from compat import link_button
from db import table, unit_image_select
from db_client.tracker_mapper import tracker_financials_to_opportunity
from navigation import PAGE_BROWSE, go_unit, location_caption, render_breadcrumb, require_building, set_unit

require_auth()
inject_global_styles()

building_id, building_label = require_building()
render_breadcrumb(('Opportunities', PAGE_BROWSE), (building_label, None))

caption = location_caption()
if caption:
    st.caption(caption)

try:
    building_response = table('buildings').select('*').eq('id', building_id).maybe_single().execute()
    building = building_response.data if building_response is not None else None
except Exception:
    building = None

try:
    summary_response = (
        table('building_summary')
        .select('*')
        .eq('building_id', building_id)
        .maybe_single()
        .execute()
    )
    summary = summary_response.data if summary_response is not None else None
except Exception:
    summary = None

st.title(building_nav_label(building) if building else building_label)
if building and building.get('address'):
    st.caption(building['address'])

if summary:
    col1, col2, col3, col4 = st.columns(4)
    col1.metric('Units', int(summary['unit_count']))
    col2.metric('Avg rent', format_currency(summary.get('avg_monthly_rent')))
    col3.metric('Avg cap rate', format_pct(summary.get('avg_cap_rate_pct')))
    col4.metric('Data completeness', f"{summary.get('data_completeness_pct', 0):.1f}%")
    feasibility_badge(summary.get('feasible', False))

if building and building.get('image_url'):
    render_card_media(building['image_url'])

units_fin = (
    table('unit_financials')
    .select('*')
    .eq('building_id', building_id)
    .order('unit_number')
    .execute()
    .data
    or []
)

if not units_fin:
    st.info('No units in this building yet.')
    st.stop()

unit_meta = (
    table('units')
    .select(unit_image_select('beds, baths, sqft, building_id'))
    .eq('building_id', building_id)
    .execute()
    .data
    or []
)
meta_by_unit = {u['id']: u for u in unit_meta}

st.subheader('Units')


def _render_building_unit_card(fin: dict) -> None:
    meta = meta_by_unit.get(fin['unit_id'], {})
    opp = tracker_financials_to_opportunity(
        fin,
        building=building,
        unit_images={
            'image_url': meta.get('image_url') or (building or {}).get('image_url'),
            'image_url_2': meta.get('image_url_2') or (building or {}).get('image_url_2'),
        },
    )
    listing = opp.listing_url

    with st.container(border=True):
        st.markdown('<div class="opp-card-marker"></div>', unsafe_allow_html=True)
        render_card_header(f"Unit {fin['unit_number']}", opp.location or None)
        render_card_media_pair([opp.image_url, opp.image_url_2], fallback_emoji=_property_emoji(opp))
        render_opportunity_financial_tags(opp)
        render_opportunity_metric_grid(opp)
        st.markdown(
            f'<div class="card-footer-block"><div class="badge-row">{_status_badge(opp.status)}{_confidence_badge(opp.confidence)}</div></div>',
            unsafe_allow_html=True,
        )
        action_cols = st.columns(2, gap='small')
        with action_cols[0]:
            if st.button('Unit', key=f'bldg_unit_{fin["unit_id"]}', use_container_width=True, type='primary'):
                set_unit(fin['unit_id'])
                go_unit()
        with action_cols[1]:
            if listing and listing != '#':
                link_button('Listing', listing, use_container_width=True)


card_grid(units_fin, _render_building_unit_card)
