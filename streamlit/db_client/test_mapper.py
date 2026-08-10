"""Tests for mapper module."""

import pytest
from .types import FieldValue, PropertyOpportunity, Source
from .mapper import row_to_opportunity, opportunity_to_row, derive_confidence, derive_sources


def make_field_value(
    value: float = 100,
    status: str = 'VERIFIED',
    confidence: str = 'HIGH'
) -> dict:
    """Create a field value dict for testing."""
    return {
        'value': value,
        'status': status,
        'confidence': confidence,
        'source': 'https://example.com',
        'evidence': 'Test evidence',
    }


def make_row(
    id: str = '_example',
    cap_rate: float = 0.10,
    status: str = 'VIABLE'
) -> dict:
    """Create a property row dict for testing."""
    return {
        'id': id,
        'address': '123 Example St, Tampa, FL 33602',
        'location': 'Tampa, FL',
        'listing_url': 'https://example.com/listing/123',
        'purchase_price': make_field_value(200000),
        'monthly_rent': make_field_value(2200, 'ESTIMATED', 'MEDIUM'),
        'annual_gross_rent': 26400,
        'annual_operating_expenses': 12572,
        'noi': 13828,
        'cap_rate': cap_rate,
        'hoa': make_field_value(485),
        'assessment': make_field_value(0),
        'confidence': 'MEDIUM',
        'status': status,
        'workflow_state': 'PUBLISHED',
        'sources': [{'label': 'Listing', 'url': 'https://example.com/listing/123'}],
        'ranked_at': '2026-08-09T18:00:00Z',
    }


class TestRowToOpportunity:
    """Tests for row_to_opportunity function."""

    def test_converts_full_row(self):
        """Should convert a complete Supabase row to PropertyOpportunity."""
        row = make_row()
        result = row_to_opportunity(row)

        assert result.id == '_example'
        assert result.address == '123 Example St, Tampa, FL 33602'
        assert result.location == 'Tampa, FL'
        assert result.listing_url == 'https://example.com/listing/123'
        assert result.purchase_price.value == 200000
        assert result.monthly_rent.value == 2200
        assert result.annual_gross_rent == 26400
        assert result.annual_operating_expenses == 12572
        assert result.noi == 13828
        assert result.cap_rate == 0.10
        assert result.hoa.value == 485
        assert result.assessment.value == 0
        assert result.confidence == 'MEDIUM'
        assert result.status == 'VIABLE'
        assert result.ranked_at == '2026-08-09T18:00:00Z'

    def test_handles_missing_optional_fields(self):
        """Should handle missing optional fields."""
        row = make_row()
        del row['sources']
        del row['ranked_at']

        result = row_to_opportunity(row)

        assert result.sources is None
        assert result.ranked_at is None

    def test_converts_sources(self):
        """Should convert sources array."""
        row = make_row()
        result = row_to_opportunity(row)

        assert len(result.sources) == 1
        assert result.sources[0].label == 'Listing'
        assert result.sources[0].url == 'https://example.com/listing/123'


class TestOpportunityToRow:
    """Tests for opportunity_to_row function."""

    def test_converts_opportunity_to_row(self):
        """Should convert PropertyOpportunity to Supabase row dict."""
        opportunity = PropertyOpportunity(
            id='test-prop',
            address='456 Test St',
            location='Test City, FL',
            listing_url='https://example.com/test',
            purchase_price=FieldValue(value=150000, status='VERIFIED', confidence='HIGH'),
            monthly_rent=FieldValue(value=1500, status='ESTIMATED', confidence='MEDIUM'),
            annual_gross_rent=18000,
            annual_operating_expenses=6000,
            noi=12000,
            cap_rate=0.08,
            hoa=FieldValue(value=300, status='VERIFIED', confidence='HIGH'),
            assessment=FieldValue(value=0, status='VERIFIED', confidence='HIGH'),
            confidence='MEDIUM',
            status='WATCHLIST',
        )

        result = opportunity_to_row(opportunity)

        assert result['id'] == 'test-prop'
        assert result['listing_url'] == 'https://example.com/test'
        assert result['purchase_price']['value'] == 150000
        assert result['monthly_rent']['value'] == 1500
        assert result['workflow_state'] == 'PUBLISHED'

    def test_uses_custom_workflow_state(self):
        """Should use custom workflow state when provided."""
        opportunity = PropertyOpportunity(
            id='test-prop',
            address='456 Test St',
            location='Test City, FL',
            listing_url='https://example.com/test',
            purchase_price=FieldValue(value=150000, status='VERIFIED', confidence='HIGH'),
            monthly_rent=FieldValue(value=1500, status='ESTIMATED', confidence='MEDIUM'),
            annual_gross_rent=18000,
            annual_operating_expenses=6000,
            noi=12000,
            cap_rate=0.08,
            hoa=FieldValue(value=300, status='VERIFIED', confidence='HIGH'),
            assessment=FieldValue(value=0, status='VERIFIED', confidence='HIGH'),
            confidence='MEDIUM',
            status='WATCHLIST',
        )

        result = opportunity_to_row(opportunity, 'RANKED')

        assert result['workflow_state'] == 'RANKED'


class TestDeriveConfidence:
    """Tests for derive_confidence function."""

    def test_returns_minimum_confidence(self):
        """Should return minimum confidence across fields."""
        high = FieldValue(value=100, status='VERIFIED', confidence='HIGH')
        medium = FieldValue(value=100, status='ESTIMATED', confidence='MEDIUM')
        low = FieldValue(value=100, status='UNKNOWN', confidence='LOW')

        assert derive_confidence(high, high, high) == 'HIGH'
        assert derive_confidence(high, medium, high) == 'MEDIUM'
        assert derive_confidence(high, medium, low) == 'LOW'

    def test_returns_low_when_no_fields(self):
        """Should return LOW when no fields provided."""
        assert derive_confidence(None, None, None) == 'LOW'

    def test_handles_partial_fields(self):
        """Should handle partial fields."""
        high = FieldValue(value=100, status='VERIFIED', confidence='HIGH')
        assert derive_confidence(high, None, None) == 'HIGH'


class TestDeriveSources:
    """Tests for derive_sources function."""

    def test_extracts_unique_sources(self):
        """Should extract unique sources from fields."""
        pp = FieldValue(value=100, status='VERIFIED', confidence='HIGH', source='https://example.com/listing')
        rent = FieldValue(value=100, status='VERIFIED', confidence='HIGH', source='Rent comps')
        hoa = FieldValue(value=100, status='VERIFIED', confidence='HIGH', source='https://example.com/hoa')

        sources = derive_sources(pp, rent, hoa)

        assert len(sources) == 3
        assert sources[0].label == 'Purchase Price'
        assert sources[0].url == 'https://example.com/listing'
        assert sources[1].label == 'Rent comps'
        assert sources[1].url is None
        assert sources[2].label == 'HOA'
        assert sources[2].url == 'https://example.com/hoa'

    def test_deduplicates_sources(self):
        """Should deduplicate sources by URL."""
        same_source = FieldValue(value=100, status='VERIFIED', confidence='HIGH', source='https://example.com/listing')

        sources = derive_sources(same_source, same_source, same_source)

        assert len(sources) == 1

    def test_returns_empty_when_no_sources(self):
        """Should return empty list when no sources."""
        sources = derive_sources(None, None, None)
        assert sources == []
