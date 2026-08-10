"""Streamlit version and runtime compatibility helpers."""

from __future__ import annotations

import inspect

import streamlit as st


def secrets_get(key: str) -> str | None:
    try:
        secrets = st.secrets
        if hasattr(secrets, 'get'):
            return secrets.get(key)
        return secrets[key]
    except (KeyError, FileNotFoundError, TypeError, AttributeError):
        return None


def link_button(label: str, url: str, *, use_container_width: bool = False) -> None:
    if hasattr(st, 'link_button'):
        kwargs: dict = {'use_container_width': use_container_width}
        sig = inspect.signature(st.link_button)
        if 'use_container_width' not in sig.parameters:
            kwargs.pop('use_container_width', None)
        st.link_button(label, url, **kwargs)
        return
    width = ' style="display:block;text-align:center"' if use_container_width else ''
    st.markdown(
        f'<a href="{url}" target="_blank" rel="noopener noreferrer"{width}>{label}</a>',
        unsafe_allow_html=True,
    )


def sidebar_toggle(label: str, *, value: bool = False, help: str | None = None) -> bool:
    if hasattr(st, 'toggle'):
        return st.sidebar.toggle(label, value=value, help=help)
    return st.sidebar.checkbox(label, value=value, help=help)
