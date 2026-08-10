"""Supabase data layer for RealEstateHunter Streamlit app."""

from .client import SupabaseClient, list_opportunities, get_property
from .mapper import row_to_opportunity, opportunity_to_row, derive_confidence, derive_sources
from .tracker_mapper import tracker_row_to_opportunity, derive_tracker_status, derive_tracker_confidence
from .types import PropertyRow, ListOpportunitiesOptions, SyncResult, FieldValue, PropertyOpportunity

__all__ = [
    'SupabaseClient',
    'list_opportunities',
    'get_property',
    'row_to_opportunity',
    'opportunity_to_row',
    'tracker_row_to_opportunity',
    'derive_tracker_status',
    'derive_tracker_confidence',
    'derive_confidence',
    'derive_sources',
    'PropertyRow',
    'ListOpportunitiesOptions',
    'SyncResult',
    'FieldValue',
    'PropertyOpportunity',
]
