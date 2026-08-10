"""
Tests for Supabase query functions
Uses mocked Supabase responses (no live DB in CI)
"""

import pytest
from unittest.mock import Mock, MagicMock

from lib.supabase_py.types import (
    FieldValue,
    PropertyRow,
    PropertyOpportunity,
    ListOpportunitiesOptions,
)
from lib.supabase_py.queries import (
    row_to_opportunity,
    list_opportunities,
    get_property,
    count_opportunities,
    get_viable_opportunities,
)


# Mock property data matching _example
MOCK_PROPERTY_DICT = {
    "id": "_example",
    "address": "123 Example St, Tampa, FL 33602",
    "location": "Tampa, FL",
    "listing_url": "https://example.com/listing/123",
    "purchase_price": {
        "value": 200000,
        "status": "VERIFIED",
        "confidence": "HIGH",
        "source": "https://example.com/listing/123",
        "evidence": "Listing asking price $200,000",
    },
    "monthly_rent": {
        "value": 2200,
        "status": "ESTIMATED",
        "confidence": "MEDIUM",
        "source": "Rent comps",
        "evidence": "Comp A: $2,100/mo similar 2BR condo.",
        "range_low": 2100,
        "range_high": 2300,
    },
    "hoa": {
        "value": 485,
        "status": "VERIFIED",
        "confidence": "HIGH",
        "source": "https://example.com/listing/123",
        "evidence": "Listing states HOA $485/month",
    },
    "assessment": {
        "value": 0,
        "status": "VERIFIED",
        "confidence": "HIGH",
        "source": "HOA disclosure document",
        "evidence": "No current or planned special assessments",
    },
    "annual_gross_rent": 26400,
    "annual_operating_expenses": 12572,
    "noi": 13828,
    "cap_rate": 0.0691,
    "confidence": "MEDIUM",
    "status": "REJECTED",
    "workflow_state": "AUDIT",
    "sources": [{"label": "Listing", "url": "https://example.com/listing/123"}],
    "ranked_at": None,
    "synced_at": "2026-08-10T12:00:00Z",
    "created_at": "2026-08-09T12:00:00Z",
    "updated_at": "2026-08-09T18:00:00Z",
}

MOCK_VIABLE_DICT = {
    **MOCK_PROPERTY_DICT,
    "id": "viable-property",
    "cap_rate": 0.112,
    "status": "VIABLE",
    "confidence": "HIGH",
    "workflow_state": "RANKED",
    "ranked_at": "2026-08-10T10:00:00Z",
}


def create_mock_client(data: list[dict] = None):
    """Create a mock Supabase client"""
    if data is None:
        data = [MOCK_PROPERTY_DICT]

    mock_response = Mock()
    mock_response.data = data
    mock_response.count = len(data)

    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.in_.return_value = mock_query
    mock_query.gte.return_value = mock_query
    mock_query.lte.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.execute.return_value = mock_response

    mock_client = Mock()
    mock_client.table.return_value = mock_query

    return mock_client, mock_query


class TestRowToOpportunity:
    def test_converts_dict_to_opportunity(self):
        result = row_to_opportunity(MOCK_PROPERTY_DICT)

        assert result.id == "_example"
        assert result.address == "123 Example St, Tampa, FL 33602"
        assert result.location == "Tampa, FL"
        assert result.listing_url == "https://example.com/listing/123"
        assert result.cap_rate == 0.0691
        assert result.status == "REJECTED"
        assert result.confidence == "MEDIUM"

    def test_includes_ranked_at_when_present(self):
        result = row_to_opportunity(MOCK_VIABLE_DICT)
        assert result.ranked_at == "2026-08-10T10:00:00Z"

    def test_field_values_are_correct(self):
        result = row_to_opportunity(MOCK_PROPERTY_DICT)

        assert result.purchase_price.value == 200000
        assert result.purchase_price.status == "VERIFIED"
        assert result.purchase_price.confidence == "HIGH"

        assert result.monthly_rent.value == 2200
        assert result.monthly_rent.status == "ESTIMATED"
        assert result.monthly_rent.range_low == 2100
        assert result.monthly_rent.range_high == 2300


class TestListOpportunities:
    def test_calls_table_and_select(self):
        mock_client, mock_query = create_mock_client()

        result = list_opportunities(mock_client)

        mock_client.table.assert_called_with("properties")
        mock_query.select.assert_called_with("*")
        assert len(result) == 1
        assert result[0].id == "_example"

    def test_applies_status_filter(self):
        mock_client, mock_query = create_mock_client([MOCK_VIABLE_DICT])

        list_opportunities(
            mock_client, ListOpportunitiesOptions(status="VIABLE")
        )

        mock_query.eq.assert_any_call("status", "VIABLE")

    def test_applies_cap_rate_filters(self):
        mock_client, mock_query = create_mock_client([MOCK_VIABLE_DICT])

        list_opportunities(
            mock_client,
            ListOpportunitiesOptions(min_cap_rate=0.10, max_cap_rate=0.15),
        )

        mock_query.gte.assert_called_with("cap_rate", 0.10)
        mock_query.lte.assert_called_with("cap_rate", 0.15)

    def test_applies_workflow_state_list_filter(self):
        mock_client, mock_query = create_mock_client([MOCK_VIABLE_DICT])

        list_opportunities(
            mock_client,
            ListOpportunitiesOptions(workflow_state=["RANKED", "PUBLISHED"]),
        )

        mock_query.in_.assert_called_with("workflow_state", ["RANKED", "PUBLISHED"])

    def test_applies_ordering(self):
        mock_client, mock_query = create_mock_client()

        list_opportunities(
            mock_client,
            ListOpportunitiesOptions(order_by="noi", order_direction="asc"),
        )

        mock_query.order.assert_called_with("noi", desc=False)

    def test_applies_pagination(self):
        mock_client, mock_query = create_mock_client()

        list_opportunities(
            mock_client,
            ListOpportunitiesOptions(limit=10, offset=20),
        )

        mock_query.limit.assert_called_with(10)
        mock_query.range.assert_called_with(20, 29)


class TestGetProperty:
    def test_fetches_single_property(self):
        mock_client, mock_query = create_mock_client()

        result = get_property(mock_client, "_example")

        mock_client.table.assert_called_with("properties")
        mock_query.eq.assert_called_with("id", "_example")
        assert result is not None
        assert result.id == "_example"

    def test_returns_none_when_not_found(self):
        mock_client, mock_query = create_mock_client([])

        result = get_property(mock_client, "nonexistent")

        assert result is None


class TestCountOpportunities:
    def test_returns_count(self):
        mock_client, mock_query = create_mock_client([MOCK_PROPERTY_DICT, MOCK_VIABLE_DICT])

        result = count_opportunities(mock_client)

        assert result == 2

    def test_applies_filters(self):
        mock_client, mock_query = create_mock_client([MOCK_VIABLE_DICT])

        count_opportunities(
            mock_client, ListOpportunitiesOptions(status="VIABLE")
        )

        mock_query.eq.assert_any_call("status", "VIABLE")


class TestGetViableOpportunities:
    def test_filters_for_viable_and_ranked(self):
        mock_client, mock_query = create_mock_client([MOCK_VIABLE_DICT])

        result = get_viable_opportunities(mock_client)

        mock_query.eq.assert_any_call("status", "VIABLE")
        mock_query.in_.assert_called_with("workflow_state", ["RANKED", "PUBLISHED"])
        assert len(result) == 1
        assert result[0].status == "VIABLE"
