"""Load published opportunities from Supabase with sample-data fallback."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import streamlit as st

from db_client import SupabaseClient, list_opportunities
from db_client.types import ListOpportunitiesOptions, PropertyOpportunity, PropertyStatus
from sample_data import SAMPLE_OPPORTUNITIES

PUBLISHABLE_STATUSES: list[PropertyStatus] = ['VIABLE', 'WATCHLIST', 'REJECTED']


@dataclass
class LoadResult:
    opportunities: list[PropertyOpportunity]
    source: str
    error: Optional[str] = None


def _secrets_get(key: str) -> Optional[str]:
    try:
        return st.secrets.get(key)
    except (KeyError, FileNotFoundError, AttributeError):
        return None


def _resolve_supabase_config() -> tuple[Optional[str], Optional[str], Optional[str]]:
    url = _secrets_get('SUPABASE_URL') or os.environ.get('SUPABASE_URL')
    service_key = _secrets_get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    anon_key = _secrets_get('SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_ANON_KEY')
    return url, service_key, anon_key


def load_opportunities(*, use_sample_data: bool = False) -> LoadResult:
    """Fetch opportunities from Supabase or return sample data."""
    if use_sample_data:
        return LoadResult(opportunities=list(SAMPLE_OPPORTUNITIES), source='sample')

    url, service_key, anon_key = _resolve_supabase_config()
    if not url or not (service_key or anon_key):
        return LoadResult(
            opportunities=list(SAMPLE_OPPORTUNITIES),
            source='sample',
            error='Supabase credentials not configured — showing sample data.',
        )

    try:
        client = SupabaseClient(url=url, service_role_key=service_key, anon_key=anon_key)
        options = ListOpportunitiesOptions(status=PUBLISHABLE_STATUSES)
        rows = list_opportunities(client, options)
        if not rows:
            return LoadResult(
                opportunities=[],
                source='supabase',
                error='No units with financial data found in Supabase.',
            )
        return LoadResult(opportunities=rows, source='supabase')
    except Exception as exc:
        return LoadResult(
            opportunities=list(SAMPLE_OPPORTUNITIES),
            source='sample',
            error=f'Failed to load from Supabase — showing sample data. ({exc})',
        )
