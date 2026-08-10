"""
Type definitions for RealEstateHunter Supabase data

These types match the PropertyOpportunity schema and Supabase table structure.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal, Optional

FieldStatus = Literal["VERIFIED", "ESTIMATED", "UNKNOWN"]
Confidence = Literal["HIGH", "MEDIUM", "LOW"]
PropertyStatus = Literal["VIABLE", "WATCHLIST", "REJECTED"]
WorkflowState = Literal[
    "CANDIDATE",
    "SCREENED",
    "RESEARCHING",
    "READY_FOR_UNDERWRITING",
    "UNDERWRITTEN",
    "AUDIT",
    "RANKED",
    "PUBLISHED",
    "ARCHIVED",
]


@dataclass
class FieldValue:
    """A single financial or factual field with provenance"""

    status: FieldStatus
    confidence: Confidence
    value: Optional[float] = None
    source: Optional[str] = None
    evidence: Optional[str] = None
    range_low: Optional[float] = None
    range_high: Optional[float] = None

    @classmethod
    def from_dict(cls, data: dict) -> "FieldValue":
        return cls(
            value=data.get("value"),
            status=data.get("status", "UNKNOWN"),
            confidence=data.get("confidence", "LOW"),
            source=data.get("source"),
            evidence=data.get("evidence"),
            range_low=data.get("range_low"),
            range_high=data.get("range_high"),
        )

    def to_dict(self) -> dict:
        result = {
            "status": self.status,
            "confidence": self.confidence,
        }
        if self.value is not None:
            result["value"] = self.value
        if self.source:
            result["source"] = self.source
        if self.evidence:
            result["evidence"] = self.evidence
        if self.range_low is not None:
            result["range_low"] = self.range_low
        if self.range_high is not None:
            result["range_high"] = self.range_high
        return result


@dataclass
class Source:
    """A source reference with label and URL"""

    label: str
    url: str

    @classmethod
    def from_dict(cls, data: dict) -> "Source":
        return cls(label=data.get("label", ""), url=data.get("url", ""))

    def to_dict(self) -> dict:
        return {"label": self.label, "url": self.url}


@dataclass
class PropertyRow:
    """Property row as stored in Supabase"""

    id: str
    address: str
    location: str
    listing_url: str
    purchase_price: FieldValue
    monthly_rent: FieldValue
    hoa: FieldValue
    assessment: FieldValue
    annual_gross_rent: float
    annual_operating_expenses: float
    noi: float
    cap_rate: float
    confidence: Confidence
    status: PropertyStatus
    workflow_state: WorkflowState
    sources: list[Source] = field(default_factory=list)
    ranked_at: Optional[str] = None
    synced_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "PropertyRow":
        return cls(
            id=data["id"],
            address=data["address"],
            location=data["location"],
            listing_url=data["listing_url"],
            purchase_price=FieldValue.from_dict(data.get("purchase_price", {})),
            monthly_rent=FieldValue.from_dict(data.get("monthly_rent", {})),
            hoa=FieldValue.from_dict(data.get("hoa", {})),
            assessment=FieldValue.from_dict(data.get("assessment", {})),
            annual_gross_rent=data.get("annual_gross_rent", 0),
            annual_operating_expenses=data.get("annual_operating_expenses", 0),
            noi=data.get("noi", 0),
            cap_rate=data.get("cap_rate", 0),
            confidence=data.get("confidence", "LOW"),
            status=data.get("status", "REJECTED"),
            workflow_state=data.get("workflow_state", "CANDIDATE"),
            sources=[Source.from_dict(s) for s in data.get("sources", [])],
            ranked_at=data.get("ranked_at"),
            synced_at=data.get("synced_at"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )


@dataclass
class PropertyOpportunity:
    """PropertyOpportunity interface for UI consumption"""

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
    confidence: Confidence
    status: PropertyStatus
    sources: list[Source] = field(default_factory=list)
    ranked_at: Optional[str] = None

    @classmethod
    def from_row(cls, row: PropertyRow) -> "PropertyOpportunity":
        return cls(
            id=row.id,
            address=row.address,
            location=row.location,
            listing_url=row.listing_url,
            purchase_price=row.purchase_price,
            monthly_rent=row.monthly_rent,
            annual_gross_rent=row.annual_gross_rent,
            annual_operating_expenses=row.annual_operating_expenses,
            noi=row.noi,
            cap_rate=row.cap_rate,
            hoa=row.hoa,
            assessment=row.assessment,
            confidence=row.confidence,
            status=row.status,
            sources=row.sources,
            ranked_at=row.ranked_at,
        )

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        return {
            "id": self.id,
            "address": self.address,
            "location": self.location,
            "listingUrl": self.listing_url,
            "purchasePrice": self.purchase_price.to_dict(),
            "monthlyRent": self.monthly_rent.to_dict(),
            "annualGrossRent": self.annual_gross_rent,
            "annualOperatingExpenses": self.annual_operating_expenses,
            "noi": self.noi,
            "capRate": self.cap_rate,
            "hoa": self.hoa.to_dict(),
            "assessment": self.assessment.to_dict(),
            "confidence": self.confidence,
            "status": self.status,
            "sources": [s.to_dict() for s in self.sources],
            "rankedAt": self.ranked_at,
        }


@dataclass
class ListOpportunitiesOptions:
    """Query options for listing properties"""

    status: Optional[PropertyStatus] = None
    min_cap_rate: Optional[float] = None
    max_cap_rate: Optional[float] = None
    confidence: Optional[Confidence] = None
    workflow_state: Optional[WorkflowState | list[WorkflowState]] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    order_by: str = "cap_rate"
    order_direction: Literal["asc", "desc"] = "desc"
