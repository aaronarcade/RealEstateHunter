"""RealEstateHunter Streamlit opportunity comparison UI."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import streamlit as st

from auth import logout_button, require_auth
from components.ui import inject_global_styles

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

browse_page = st.Page('views/browse.py', title='Opportunities', icon='🏠', default=True)
building_page = st.Page('views/building.py', title='Building', icon='🏢')
unit_page = st.Page('views/unit.py', title='Unit', icon='🔑')

pg = st.navigation(
    {
        'Browse': [browse_page],
        'Property': [building_page, unit_page],
    }
)
pg.run()
