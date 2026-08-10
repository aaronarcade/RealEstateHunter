"""
Supabase client factory for RealEstateHunter
"""

import os
from typing import Optional

from supabase import create_client as supabase_create_client, Client


def create_client(url: Optional[str] = None, key: Optional[str] = None) -> Client:
    """
    Create a Supabase client instance.

    Uses environment variables by default:
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY (server) or SUPABASE_ANON_KEY (browser)

    For Streamlit, also checks st.secrets if available.

    Args:
        url: Override Supabase URL
        key: Override Supabase key

    Returns:
        Configured Supabase client
    """
    resolved_url = url
    resolved_key = key

    # Try environment variables
    if not resolved_url:
        resolved_url = os.environ.get("SUPABASE_URL")

    if not resolved_key:
        resolved_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get(
            "SUPABASE_ANON_KEY"
        )

    # Try Streamlit secrets if available
    if not resolved_url or not resolved_key:
        try:
            import streamlit as st

            if not resolved_url and hasattr(st, "secrets"):
                resolved_url = st.secrets.get("SUPABASE_URL")
            if not resolved_key and hasattr(st, "secrets"):
                resolved_key = st.secrets.get(
                    "SUPABASE_SERVICE_ROLE_KEY"
                ) or st.secrets.get("SUPABASE_ANON_KEY")
        except ImportError:
            pass

    if not resolved_url:
        raise ValueError(
            "Supabase URL not configured. Set SUPABASE_URL environment variable "
            "or pass url parameter."
        )

    if not resolved_key:
        raise ValueError(
            "Supabase key not configured. Set SUPABASE_SERVICE_ROLE_KEY or "
            "SUPABASE_ANON_KEY environment variable or pass key parameter."
        )

    return supabase_create_client(resolved_url, resolved_key)


def validate_config() -> tuple[bool, list[str]]:
    """
    Validate that environment is properly configured.

    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors: list[str] = []

    url = os.environ.get("SUPABASE_URL")
    if not url:
        errors.append("Missing SUPABASE_URL environment variable")

    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get(
        "SUPABASE_ANON_KEY"
    )
    if not key:
        errors.append("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY")

    return (len(errors) == 0, errors)
