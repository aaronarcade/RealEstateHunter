"""Mapping functions between Supabase rows and PropertyOpportunity."""

from typing import Optional, List
from .types import FieldValue, PropertyOpportunity, PropertyRow, Source, ConfidenceLevel


def row_to_opportunity(row: dict) -> PropertyOpportunity:
    """Convert a Supabase row dict to PropertyOpportunity."""
    sources = None
    if row.get('sources'):
        sources = [Source(label=s.get('label'), url=s.get('url')) for s in row['sources']]

    return PropertyOpportunity(
        id=row['id'],
        address=row['address'],
        location=row['location'],
        listing_url=row['listing_url'],
        purchase_price=FieldValue.from_dict(row['purchase_price']),
        monthly_rent=FieldValue.from_dict(row['monthly_rent']),
        annual_gross_rent=row['annual_gross_rent'],
        annual_operating_expenses=row['annual_operating_expenses'],
        noi=row['noi'],
        cap_rate=row['cap_rate'],
        hoa=FieldValue.from_dict(row['hoa']),
        assessment=FieldValue.from_dict(row['assessment']),
        confidence=row['confidence'],
        status=row['status'],
        sources=sources,
        ranked_at=row.get('ranked_at'),
    )


def opportunity_to_row(opportunity: PropertyOpportunity, workflow_state: str = 'PUBLISHED') -> dict:
    """Convert a PropertyOpportunity to Supabase row dict."""
    sources = None
    if opportunity.sources:
        sources = [{'label': s.label, 'url': s.url} for s in opportunity.sources]

    return {
        'id': opportunity.id,
        'address': opportunity.address,
        'location': opportunity.location,
        'listing_url': opportunity.listing_url,
        'purchase_price': opportunity.purchase_price.to_dict(),
        'monthly_rent': opportunity.monthly_rent.to_dict(),
        'annual_gross_rent': opportunity.annual_gross_rent,
        'annual_operating_expenses': opportunity.annual_operating_expenses,
        'noi': opportunity.noi,
        'cap_rate': opportunity.cap_rate,
        'hoa': opportunity.hoa.to_dict(),
        'assessment': opportunity.assessment.to_dict(),
        'confidence': opportunity.confidence,
        'status': opportunity.status,
        'workflow_state': workflow_state,
        'sources': sources,
        'ranked_at': opportunity.ranked_at,
    }


def derive_confidence(
    purchase_price: Optional[FieldValue],
    monthly_rent: Optional[FieldValue],
    hoa: Optional[FieldValue]
) -> ConfidenceLevel:
    """Derive overall confidence as minimum confidence across key fields."""
    confidence_levels = ['HIGH', 'MEDIUM', 'LOW']
    values = [
        f.confidence for f in [purchase_price, monthly_rent, hoa]
        if f is not None and f.confidence
    ]

    if not values:
        return 'LOW'

    min_index = 0
    for value in values:
        index = confidence_levels.index(value)
        if index > min_index:
            min_index = index

    return confidence_levels[min_index]


def derive_sources(
    purchase_price: Optional[FieldValue],
    monthly_rent: Optional[FieldValue],
    hoa: Optional[FieldValue]
) -> List[Source]:
    """Extract unique sources from fields."""
    sources: List[Source] = []
    seen: set = set()

    fields = [
        (purchase_price, 'Purchase Price'),
        (monthly_rent, 'Monthly Rent'),
        (hoa, 'HOA'),
    ]

    for field_value, label in fields:
        if field_value and field_value.source and field_value.source not in seen:
            seen.add(field_value.source)
            is_url = field_value.source.startswith('http://') or field_value.source.startswith('https://')
            sources.append(Source(
                label=label if is_url else field_value.source,
                url=field_value.source if is_url else None,
            ))

    return sources
