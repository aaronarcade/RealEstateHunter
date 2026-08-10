"""Supabase data layer for RealEstateHunter Streamlit app."""

from .client import SupabaseClient, list_opportunities, get_property
from .mapper import row_to_opportunity, opportunity_to_row, derive_confidence, derive_sources
from .types import PropertyRow, ListOpportunitiesOptions, SyncResult, FieldValue, PropertyOpportunity

__all__ = [
    'SupabaseClient',
    'list_opportunities',
    'get_property',
    'row_to_opportunity',
    'opportunity_to_row',
    'derive_confidence',
    'derive_sources',
    'PropertyRow',
    'ListOpportunitiesOptions',
    'SyncResult',
    'FieldValue',
    'PropertyOpportunity',
]
