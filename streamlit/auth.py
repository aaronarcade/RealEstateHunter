"""Password gate for Streamlit app (single shared password via secrets)."""

from __future__ import annotations

import os

import streamlit as st


def init_session_state() -> None:
    if 'authenticated' not in st.session_state:
        st.session_state.authenticated = False


def _app_password() -> str | None:
    try:
        return st.secrets.get('APP_PASSWORD')
    except (KeyError, FileNotFoundError, AttributeError):
        return os.environ.get('APP_PASSWORD')


def logout_button() -> None:
    if st.sidebar.button('Sign out', use_container_width=True):
        st.session_state.authenticated = False
        st.rerun()


def login_form() -> None:
    st.title('RealEstateHunter')
    st.caption('Investment Opportunities')
    st.subheader('Sign in')

    password_configured = bool(_app_password())
    if not password_configured:
        st.error('APP_PASSWORD is not configured. Add it to .streamlit/secrets.toml or environment.')
        st.stop()

    with st.form('login_form', clear_on_submit=False):
        password = st.text_input('Password', type='password')
        submitted = st.form_submit_button('Sign in', type='primary', use_container_width=True)
        if submitted:
            expected = _app_password() or ''
            if password == expected:
                st.session_state.authenticated = True
                st.rerun()
            else:
                st.error('Invalid credentials.')


def require_auth() -> None:
    """Block the app until the user authenticates."""
    init_session_state()
    if not st.session_state.authenticated:
        login_form()
        st.stop()
