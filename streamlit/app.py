"""RealEstateHunter Streamlit opportunity comparison UI."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import streamlit as st

if not hasattr(st, 'Page') or not hasattr(st, 'navigation'):
    st.error('This app requires Streamlit >= 1.37. Reboot the app after dependencies install.')
    st.stop()

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
reviewed_page = st.Page('views/reviewed.py', title='Reviewed', icon='📋')
market_page = st.Page('views/market_research.py', title='Market Research', icon='📊')
building_page = st.Page('views/building.py', title='Building', icon='🏢')
unit_page = st.Page('views/unit.py', title='Unit', icon='🔑')

pg = st.navigation(
    {
        'Browse': [browse_page, reviewed_page, market_page],
        'Property': [building_page, unit_page],
    }
)
pg.run()
