"""Supabase table access for Streamlit views."""

from __future__ import annotations

import os
from pathlib import Path

import streamlit as st

from db_client import SupabaseClient

_image_url_2_available: bool | None = None


def _load_dotenv() -> None:
    env_path = Path(__file__).resolve().parent.parent / '.env'
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


from compat import secrets_get as _secrets_get


def get_client():
    if 'supabase_raw_client' not in st.session_state:
        _load_dotenv()
        url = _secrets_get('SUPABASE_URL') or os.environ.get('SUPABASE_URL')
        service_key = _secrets_get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
        anon_key = _secrets_get('SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_ANON_KEY')
        wrapper = SupabaseClient(url=url, service_role_key=service_key, anon_key=anon_key)
        st.session_state.supabase_raw_client = wrapper.client
    return st.session_state.supabase_raw_client


def table(name: str):
    return get_client().table(name)


def select_by_id(table_name: str, record_id: str) -> dict | None:
    try:
        response = table(table_name).select('*').eq('id', record_id).maybe_single().execute()
        if response is None:
            return None
        return response.data
    except Exception:
        return None


def has_image_url_2() -> bool:
    global _image_url_2_available
    if _image_url_2_available is not None:
        return _image_url_2_available
    try:
        table('units').select('image_url_2').limit(1).execute()
        _image_url_2_available = True
    except Exception:
        _image_url_2_available = False
    return _image_url_2_available


def unit_image_select(extra: str = '') -> str:
    fields = 'id, image_url'
    if has_image_url_2():
        fields += ', image_url_2'
    if extra:
        fields += f', {extra}'
    return fields
