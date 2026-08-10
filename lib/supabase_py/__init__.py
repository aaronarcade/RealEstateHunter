"""
Supabase read client for RealEstateHunter

This module provides Python functions for querying property data from Supabase.
Designed for use with Streamlit and other Python-based UIs.
"""

from .client import create_client, validate_config
from .queries import (
    list_opportunities,
    get_property,
    get_property_with_details,
    count_opportunities,
    get_viable_opportunities,
    get_watchlist_opportunities,
    row_to_opportunity,
)
from .types import (
    FieldValue,
    Source,
    PropertyRow,
    PropertyOpportunity,
    ListOpportunitiesOptions,
)

__all__ = [
    # Client
    "create_client",
    "validate_config",
    # Queries
    "list_opportunities",
    "get_property",
    "get_property_with_details",
    "count_opportunities",
    "get_viable_opportunities",
    "get_watchlist_opportunities",
    "row_to_opportunity",
    # Types
    "FieldValue",
    "Source",
    "PropertyRow",
    "PropertyOpportunity",
    "ListOpportunitiesOptions",
]

__version__ = "0.1.0"
