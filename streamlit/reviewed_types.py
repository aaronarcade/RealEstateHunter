"""Types for the reviewed listings browse feature."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


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
