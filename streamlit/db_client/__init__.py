"""Supabase data layer for RealEstateHunter Streamlit app."""

from .client import SupabaseClient, list_opportunities, get_property, list_reviewed_listings, list_market_listings
from .mapper import row_to_opportunity, opportunity_to_row, derive_confidence, derive_sources
from .tracker_mapper import (
    tracker_row_to_opportunity,
    tracker_financials_to_opportunity,
    derive_tracker_status,
    derive_tracker_confidence,
)
from .types import PropertyRow, ListOpportunitiesOptions, SyncResult, FieldValue, PropertyOpportunity
from reviewed_types import ListReviewedOptions, ReviewedListing
from market_types import ListMarketOptions, MarketListing

__all__ = [
    'SupabaseClient',
    'list_opportunities',
    'get_property',
    'list_reviewed_listings',
    'list_market_listings',
    'row_to_opportunity',
    'opportunity_to_row',
    'tracker_row_to_opportunity',
    'tracker_financials_to_opportunity',
    'derive_tracker_status',
    'derive_tracker_confidence',
    'derive_confidence',
    'derive_sources',
    'PropertyRow',
    'ListOpportunitiesOptions',
    'ListReviewedOptions',
    'SyncResult',
    'FieldValue',
    'PropertyOpportunity',
    'ReviewedListing',
    'ListMarketOptions',
    'MarketListing',
]
