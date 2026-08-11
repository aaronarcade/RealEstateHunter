"""Type definitions for Supabase data layer."""

from dataclasses import dataclass, field
from typing import Optional, List, Literal
from datetime import datetime


ConfidenceLevel = Literal['HIGH', 'MEDIUM', 'LOW']
FieldStatus = Literal['VERIFIED', 'ESTIMATED', 'UNKNOWN']
PropertyStatus = Literal['VIABLE', 'WATCHLIST', 'REJECTED']


@dataclass
class FieldValue:
    """Field value with provenance - used throughout evidence and underwriting."""
    value: Optional[float]
    status: FieldStatus
    confidence: ConfidenceLevel
    source: Optional[str] = None
    evidence: Optional[str] = None
    range_low: Optional[float] = None
    range_high: Optional[float] = None

    @classmethod
    def from_dict(cls, data: dict) -> 'FieldValue':
        return cls(
            value=data.get('value'),
            status=data.get('status', 'UNKNOWN'),
            confidence=data.get('confidence', 'LOW'),
            source=data.get('source'),
            evidence=data.get('evidence'),
            range_low=data.get('range_low'),
            range_high=data.get('range_high'),
        )

    def to_dict(self) -> dict:
        result = {
            'value': self.value,
            'status': self.status,
            'confidence': self.confidence,
        }
        if self.source:
            result['source'] = self.source
        if self.evidence:
            result['evidence'] = self.evidence
        if self.range_low is not None:
            result['range_low'] = self.range_low
        if self.range_high is not None:
            result['range_high'] = self.range_high
        return result


@dataclass
class Source:
    """Source reference."""
    label: Optional[str] = None
    url: Optional[str] = None


@dataclass
class PropertyOpportunity:
    """Published opportunity for UI display."""
    id: str
    address: str
    location: str
    listing_url: str
    purchase_price: FieldValue
    monthly_rent: FieldValue
    annual_gross_rent: float
    annual_operating_expenses: float
    noi: float
    cap_rate: float
    hoa: FieldValue
    assessment: FieldValue
    confidence: ConfidenceLevel
    status: PropertyStatus
    sources: Optional[List[Source]] = None
    ranked_at: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    neighborhood: Optional[str] = None
    image_url: Optional[str] = None
    image_url_2: Optional[str] = None
    property_type: Optional[str] = None
    building_id: Optional[str] = None
    neighborhood_id: Optional[str] = None
    unit_number: Optional[str] = None
    str_allowed: Optional[bool] = None


@dataclass
class PropertyRow:
    """Supabase row representation."""
    id: str
    address: str
    location: str
    listing_url: str
    purchase_price: dict
    monthly_rent: dict
    annual_gross_rent: float
    annual_operating_expenses: float
    noi: float
    cap_rate: float
    hoa: dict
    assessment: dict
    confidence: ConfidenceLevel
    status: PropertyStatus
    workflow_state: str
    sources: Optional[List[dict]] = None
    ranked_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@dataclass
class ListOpportunitiesOptions:
    """Options for listing opportunities."""
    status: Optional[List[PropertyStatus]] = None
    min_cap_rate: Optional[float] = None
    limit: Optional[int] = None
    offset: Optional[int] = None


@dataclass
class ReviewedListing:
    """Lightweight scout first-pass listing for baseline analytics."""
    id: str
    address: str
    city: str
    country: str
    listing_url: str
    asking_price: float
    scout_decision: str
    reviewed_at: str
    region: Optional[str] = None
    estimated_cap_rate: Optional[float] = None
    rough_gross_yield: Optional[float] = None
    estimated_monthly_rent: Optional[float] = None
    hoa_monthly: Optional[float] = None
    sqft: Optional[float] = None
    beds: Optional[int] = None
    baths: Optional[float] = None
    property_type: Optional[str] = None
    market_id: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class ListReviewedOptions:
    """Options for listing reviewed listings."""
    country: Optional[str] = None
    city: Optional[str] = None
    market_id: Optional[str] = None
    min_cap_rate: Optional[float] = None
    max_cap_rate: Optional[float] = None
    limit: Optional[int] = None
    offset: Optional[int] = None


@dataclass
class SyncResult:
    """Result of sync operation."""
    inserted: int = 0
    updated: int = 0
    errors: List[dict] = field(default_factory=list)
