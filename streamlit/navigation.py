"""Page routing and drill-down navigation."""

from __future__ import annotations

from pathlib import Path

import streamlit as st

_APP_DIR = Path(__file__).resolve().parent

NAV_COUNTRY_LABEL = 'nav_country_label'
NAV_REGION_LABEL = 'nav_region_label'
NAV_NEIGHBORHOOD_ID = 'nav_neighborhood_id'
NAV_NEIGHBORHOOD_LABEL = 'nav_neighborhood_label'
NAV_BUILDING_ID = 'nav_building_id'
NAV_BUILDING_LABEL = 'nav_building_label'
SELECTED_UNIT_ID = 'selected_unit_id'

PAGE_BROWSE = str(_APP_DIR / 'views' / 'browse.py')
PAGE_BUILDING = str(_APP_DIR / 'views' / 'building.py')
PAGE_UNIT = str(_APP_DIR / 'views' / 'unit.py')


def set_building(building_id: str, label: str) -> None:
    st.session_state[NAV_BUILDING_ID] = building_id
    st.session_state[NAV_BUILDING_LABEL] = label


def set_unit(unit_id: str) -> None:
    st.session_state[SELECTED_UNIT_ID] = unit_id


def set_context_from_opportunity(opp) -> None:
    if opp.country:
        st.session_state[NAV_COUNTRY_LABEL] = opp.country
    if opp.region:
        st.session_state[NAV_REGION_LABEL] = opp.region
    if opp.neighborhood_id:
        st.session_state[NAV_NEIGHBORHOOD_ID] = opp.neighborhood_id
    if opp.neighborhood:
        st.session_state[NAV_NEIGHBORHOOD_LABEL] = opp.neighborhood
    if opp.building_id:
        label = opp.address.split(',', 1)[-1].strip() if ',' in opp.address else opp.address
        set_building(opp.building_id, label)
    set_unit(opp.id)


def go_browse() -> None:
    st.switch_page(PAGE_BROWSE)


def go_building() -> None:
    st.switch_page(PAGE_BUILDING)


def go_unit() -> None:
    st.switch_page(PAGE_UNIT)


def require_building() -> tuple[str, str]:
    building_id = st.session_state.get(NAV_BUILDING_ID)
    label = st.session_state.get(NAV_BUILDING_LABEL, 'Building')
    if not building_id:
        st.warning('Select a building first.')
        if st.button('Back to opportunities', type='primary'):
            go_browse()
        st.stop()
    return building_id, label


def require_unit() -> str:
    unit_id = st.session_state.get(SELECTED_UNIT_ID)
    if not unit_id:
        st.warning('Select a unit first.')
        if st.button('Back to opportunities', type='primary'):
            go_browse()
        st.stop()
    return unit_id


def location_caption() -> str | None:
    parts = [
        st.session_state.get(NAV_NEIGHBORHOOD_LABEL),
        st.session_state.get(NAV_REGION_LABEL),
        st.session_state.get(NAV_COUNTRY_LABEL),
    ]
    parts = [part for part in parts if part]
    return ' · '.join(parts) if parts else None


def render_breadcrumb(*crumbs: tuple[str, str | None]) -> None:
    cols = st.columns(min(len(crumbs), 6))
    for idx, (label, page) in enumerate(crumbs):
        with cols[idx]:
            if page is None:
                st.markdown(f'**{label}**')
            elif st.button(label, key=f'crumb_{idx}_{label}', use_container_width=True):
                st.switch_page(page)
