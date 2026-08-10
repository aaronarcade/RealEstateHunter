"""Map RealEstateTracker Supabase rows to PropertyOpportunity."""

from __future__ import annotations

from typing import Optional

from .types import ConfidenceLevel, FieldValue, PropertyOpportunity, PropertyStatus, Source

CAP_VIABLE_PCT = 10.0
CAP_WATCHLIST_PCT = 6.0


def derive_tracker_status(
    cap_rate_pct: float | None,
    has_complete: bool,
    unit_status: str | None,
) -> PropertyStatus:
    if unit_status == 'passed':
        return 'REJECTED'
    if not has_complete or cap_rate_pct is None:
        return 'WATCHLIST'
    if cap_rate_pct >= CAP_VIABLE_PCT:
        return 'VIABLE'
    if cap_rate_pct >= CAP_WATCHLIST_PCT:
        return 'WATCHLIST'
    return 'REJECTED'


def derive_tracker_confidence(has_complete: bool, source_confidence: int | None) -> ConfidenceLevel:
    if not has_complete:
        return 'LOW'
    if source_confidence is not None and source_confidence <= 2:
        return 'LOW'
    if source_confidence is not None and source_confidence == 3:
        return 'MEDIUM'
    return 'HIGH'


def _numeric_field(
    value: float | None,
    *,
    has_complete: bool,
    source_url: str | None = None,
    evidence: str | None = None,
) -> FieldValue:
    if value is None:
        return FieldValue(value=None, status='UNKNOWN', confidence='LOW')

    return FieldValue(
        value=float(value),
        status='VERIFIED' if has_complete else 'ESTIMATED',
        confidence='HIGH' if has_complete else 'MEDIUM',
        source=source_url,
        evidence=evidence or ('Complete unit financials' if has_complete else 'Partial unit financials'),
    )


def tracker_financials_to_opportunity(
    fin: dict,
    *,
    building: dict | None = None,
    source_url: str | None = None,
    source_confidence: int | None = None,
    unit_images: dict | None = None,
) -> PropertyOpportunity:
    """Build PropertyOpportunity from unit_financials when RPC is unavailable."""
    neighborhood = (building or {}).get('neighborhoods') or {}
    region = neighborhood.get('regions') or {}
    country = region.get('countries') or {}
    row = {
        'unit_id': fin.get('unit_id'),
        'unit_number': fin.get('unit_number'),
        'building_id': fin.get('building_id'),
        'neighborhood_id': neighborhood.get('id'),
        'monthly_rent': fin.get('monthly_rent'),
        'noi': fin.get('noi'),
        'cap_rate_pct': fin.get('cap_rate_pct'),
        'value_basis': fin.get('value_basis'),
        'has_complete_financials': fin.get('has_complete_financials'),
        'status': fin.get('status'),
        'str_allowed': fin.get('str_allowed'),
        'building_address': (building or {}).get('address') or '',
        'neighborhood_name': neighborhood.get('name'),
        'region_name': region.get('name'),
        'country_name': country.get('name'),
    }
    return tracker_row_to_opportunity(
        row,
        financials=fin,
        source_url=source_url,
        source_confidence=source_confidence,
        unit_images=unit_images,
        property_type=fin.get('property_type'),
    )


def tracker_row_to_opportunity(
    row: dict,
    *,
    financials: dict | None = None,
    source_url: str | None = None,
    source_confidence: int | None = None,
    unit_images: dict | None = None,
    property_type: str | None = None,
) -> PropertyOpportunity:
    """Convert get_cap_rate_summary row (+ optional unit_financials) to PropertyOpportunity."""
    fin = financials or {}
    has_complete = bool(row.get('has_complete_financials') or fin.get('has_complete_financials'))
    cap_rate_pct = row.get('cap_rate_pct')
    if cap_rate_pct is None and fin.get('cap_rate_pct') is not None:
        cap_rate_pct = fin.get('cap_rate_pct')

    cap_rate = float(cap_rate_pct) / 100 if cap_rate_pct is not None else 0.0
    unit_status = row.get('status') or fin.get('status')
    status = derive_tracker_status(
        float(cap_rate_pct) if cap_rate_pct is not None else None,
        has_complete,
        unit_status,
    )
    confidence = derive_tracker_confidence(has_complete, source_confidence)

    unit_number = row.get('unit_number') or fin.get('unit_number') or '?'
    building_address = row.get('building_address') or ''
    address = f'Unit {unit_number}, {building_address}'.strip(', ')

    location_parts = [
        row.get('neighborhood_name'),
        row.get('region_name'),
        row.get('country_name'),
    ]
    location = ', '.join(part for part in location_parts if part)

    value_basis = row.get('value_basis') or fin.get('value_basis')
    monthly_rent = row.get('monthly_rent') if row.get('monthly_rent') is not None else fin.get('monthly_rent')
    noi = row.get('noi') if row.get('noi') is not None else fin.get('noi') or 0.0
    hoa_monthly = fin.get('hoa_monthly')
    assessment_monthly = fin.get('assessment_fees_monthly')
    annual_gross = fin.get('gross_annual_rent') or (float(monthly_rent) * 12 if monthly_rent else 0.0)
    annual_opex = fin.get('annual_operating_expenses') or 0.0

    purchase_price = _numeric_field(
        float(value_basis) if value_basis is not None else None,
        has_complete=has_complete,
        source_url=source_url,
        evidence='COALESCE(purchase_price, estimated_value)',
    )
    monthly_rent_field = _numeric_field(
        float(monthly_rent) if monthly_rent is not None else None,
        has_complete=has_complete,
        source_url=source_url,
    )
    hoa_field = _numeric_field(
        float(hoa_monthly) if hoa_monthly is not None else None,
        has_complete=has_complete,
        source_url=source_url,
    )
    assessment_field = _numeric_field(
        float(assessment_monthly) if assessment_monthly is not None else 0.0 if has_complete else None,
        has_complete=has_complete,
        source_url=source_url,
        evidence='Monthly assessment fees',
    )

    listing_url = source_url or '#'
    sources = [Source(label='Listing', url=source_url)] if source_url else None

    images = unit_images or {}
    image_url = images.get('image_url') or row.get('image_url')
    image_url_2 = images.get('image_url_2') or row.get('image_url_2')
    prop_type = property_type or row.get('property_type') or fin.get('property_type')

    return PropertyOpportunity(
        id=str(row.get('unit_id') or fin.get('unit_id')),
        address=address,
        location=location,
        listing_url=listing_url,
        purchase_price=purchase_price,
        monthly_rent=monthly_rent_field,
        annual_gross_rent=float(annual_gross),
        annual_operating_expenses=float(annual_opex),
        noi=float(noi),
        cap_rate=cap_rate,
        hoa=hoa_field,
        assessment=assessment_field,
        confidence=confidence,
        status=status,
        sources=sources,
        ranked_at=None,
        country=row.get('country_name'),
        region=row.get('region_name'),
        neighborhood=row.get('neighborhood_name'),
        image_url=image_url,
        image_url_2=image_url_2,
        property_type=str(prop_type) if prop_type else None,
        building_id=str(row.get('building_id') or fin.get('building_id') or '') or None,
        neighborhood_id=str(row.get('neighborhood_id') or '') or None,
        unit_number=str(unit_number) if unit_number != '?' else None,
        str_allowed=row.get('str_allowed') if row.get('str_allowed') is not None else fin.get('str_allowed'),
    )
